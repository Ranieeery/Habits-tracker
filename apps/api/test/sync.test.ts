// Sync protocol: idempotency, natural-key upserts, cursor paging, user scope,
// permanent rejections, batch limits, migration backfill and the purge.
import type {
	Completion,
	Habit,
	Mutation,
	MutationResult,
	SyncPullResponse,
	SyncPushResponse,
} from "@habits/contracts";
import { SYNC_PUSH_MAX_MUTATIONS } from "@habits/contracts";
import { env } from "cloudflare:workers";
import { and, asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { isPurgeRun, runSyncPurge } from "../src/cron/sync-purge.ts";
import {
	completions,
	habits,
	processedMutations,
	syncState,
} from "../src/db/schema.ts";
import { uuidV7 } from "../src/lib/ids.ts";
import { decodeCursor } from "../src/routes/sync.ts";
import {
	createUser,
	db,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";

const TODAY = "2026-10-09";
const NOW = `${TODAY}T15:00:00Z`;
const EVERY_DAY = { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] };

let api: TestApi;
let alice: TestUser;
let bob: TestUser;
let habit: Habit;
let bobHabit: Habit;

const id = () => uuidV7(Date.parse(NOW));

async function createHabit(user: TestUser, name: string): Promise<Habit> {
	const response = await api.request(
		"/v1/habits",
		json(
			{ name, schedule: EVERY_DAY, start_date: TODAY },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: Habit }).habit;
}

beforeEach(async () => {
	await resetDb();
	api = makeApi(NOW, { ALLOW_SIGNUP: "true" });
	alice = await createUser(api, "alice@example.com");
	bob = await createUser(api, "bob@example.com");
	habit = await createHabit(alice, "Ler");
	bobHabit = await createHabit(bob, "Correr");
});

function setMutation(
	completed: boolean,
	overrides: Partial<Extract<Mutation, { type: "completion.set" }>> = {}
): Mutation {
	return {
		mutation_id: id(),
		created_at: Date.parse(NOW),
		type: "completion.set",
		id: id(),
		habit_id: habit.id,
		date: TODAY,
		completed,
		...overrides,
	};
}

async function pushRaw(user: TestUser, mutations: unknown[]) {
	return api.request(
		"/v1/sync/push",
		json({ protocol: 1, mutations }, { method: "POST", headers: user.auth() })
	);
}

async function push(
	user: TestUser,
	mutations: unknown[]
): Promise<MutationResult[]> {
	const response = await pushRaw(user, mutations);
	expect(response.status).toBe(200);
	return ((await response.json()) as SyncPushResponse).results;
}

async function pull(
	user: TestUser,
	cursor?: string,
	limit?: number
): Promise<SyncPullResponse> {
	const params = new URLSearchParams();
	if (cursor) params.set("cursor", cursor);
	if (limit) params.set("limit", String(limit));
	const response = await api.request(`/v1/sync/pull?${params}`, {
		headers: user.auth(),
	});
	expect(response.status).toBe(200);
	return (await response.json()) as SyncPullResponse;
}

/** Pulls every page from `cursor`; returns the pages and the final cursor. */
async function pullAll(user: TestUser, cursor?: string, limit?: number) {
	const pages: SyncPullResponse[] = [];
	let next = cursor;
	for (;;) {
		const page = await pull(user, next, limit);
		pages.push(page);
		next = page.cursor;
		if (!page.has_more) return { pages, cursor: next };
	}
}

function recordIds(pages: SyncPullResponse[]): string[] {
	return pages.flatMap((page) => [
		...page.changes.habits.map((h) => h.id),
		...page.changes.completions.map((c) => c.id),
	]);
}

async function storedCompletions(habitId = habit.id): Promise<Completion[]> {
	const rows = await db
		.select()
		.from(completions)
		.where(eq(completions.habit_id, habitId))
		.orderBy(asc(completions.date));
	return rows.map(({ user_id: _, server_seq: __, ...row }) => row);
}

describe("POST /v1/sync/push", () => {
	it("applies a mutation once; resending it is a duplicate with the same id", async () => {
		const mutation = setMutation(true);
		expect(await push(alice, [mutation])).toEqual([
			{
				mutation_id: mutation.mutation_id,
				status: "applied",
				canonical_id: (mutation as { id: string }).id,
			},
		]);
		const { cursor } = await pullAll(alice);

		api.setNow(`${TODAY}T16:00:00Z`);
		expect(await push(alice, [mutation])).toEqual([
			{
				mutation_id: mutation.mutation_id,
				status: "duplicate",
				canonical_id: (mutation as { id: string }).id,
			},
		]);
		// Nothing was written: no new change in the feed.
		expect(recordIds((await pullAll(alice, cursor)).pages)).toEqual([]);
	});

	it("treats a repeated mutation_id inside one batch as a duplicate", async () => {
		const mutation = setMutation(true);
		const results = await push(alice, [mutation, mutation]);
		expect(results.map((r) => r.status)).toEqual(["applied", "duplicate"]);
		expect(await storedCompletions()).toHaveLength(1);
	});

	it("concurrent identical pushes write once; the retry is a duplicate", async () => {
		const mutation = setMutation(true);
		const responses = await Promise.all([
			pushRaw(alice, [mutation]),
			pushRaw(alice, [mutation]),
		]);
		for (const response of responses) {
			expect([200, 500]).toContain(response.status);
		}
		expect(await push(alice, [mutation])).toMatchObject([
			{ status: "duplicate" },
		]);
		expect(await storedCompletions()).toHaveLength(1);
	});

	it("upserts by (habit_id, date): a second device's id maps to the first", async () => {
		const deviceA = setMutation(true);
		const deviceB = setMutation(true);
		await push(alice, [deviceA]);
		const [result] = await push(alice, [deviceB]);
		expect(result).toMatchObject({
			status: "applied",
			canonical_id: (deviceA as { id: string }).id,
		});
		const stored = await storedCompletions();
		expect(stored).toHaveLength(1);
		expect(stored[0]?.id).toBe((deviceA as { id: string }).id);
	});

	it("opposite states from two devices: the last to sync wins", async () => {
		await push(alice, [setMutation(true)]);
		api.setNow(`${TODAY}T15:05:00Z`);
		await push(alice, [setMutation(false)]);
		expect((await storedCompletions())[0]?.deleted_at).toBe(
			Date.parse(`${TODAY}T15:05:00Z`)
		);
	});

	it("check and uncheck offline: one tombstone; checking again revives it", async () => {
		const mark = setMutation(true);
		const markId = (mark as { id: string }).id;
		await push(alice, [mark, setMutation(false, { id: markId })]);
		const [tombstone] = await storedCompletions();
		expect(tombstone).toMatchObject({ id: markId });
		expect(tombstone?.deleted_at).not.toBeNull();

		api.setNow(`${TODAY}T18:00:00Z`);
		await push(alice, [setMutation(true, { id: id() })]);
		expect(await storedCompletions()).toEqual([
			expect.objectContaining({
				id: markId,
				deleted_at: null,
				completed_at: Date.parse(`${TODAY}T18:00:00Z`),
			}),
		]);
	});

	it("stamps writes with the server's clock, never the device's", async () => {
		await push(alice, [
			setMutation(true, { created_at: 1, updated_at: 2_000_000_000_000 }),
		]);
		expect((await storedCompletions())[0]).toMatchObject({
			created_at: Date.parse(NOW),
			updated_at: Date.parse(NOW),
		});
	});

	it("creates a habit and a completion of it in the same batch, in dependency order", async () => {
		const habitId = id();
		const results = await push(alice, [
			{
				mutation_id: id(),
				created_at: 1,
				type: "habit.create",
				id: habitId,
				name: "Meditar",
				schedule: EVERY_DAY,
				start_date: TODAY,
			},
			setMutation(true, { habit_id: habitId }),
			{
				mutation_id: id(),
				created_at: 1,
				type: "habit.update",
				habit_id: habitId,
				changes: { name: "Meditar 10 min" },
			},
		]);
		expect(results.map((r) => r.status)).toEqual([
			"applied",
			"applied",
			"applied",
		]);
		const [stored] = await db
			.select()
			.from(habits)
			.where(eq(habits.id, habitId));
		expect(stored).toMatchObject({ name: "Meditar 10 min", user_id: alice.id });
		expect(await storedCompletions(habitId)).toHaveLength(1);
	});

	it("updates habits per field: a rename by sync keeps an archive made via REST", async () => {
		const patch = await api.request(
			`/v1/habits/${habit.id}`,
			json({ archived: true }, { method: "PATCH", headers: alice.auth() })
		);
		expect(patch.status).toBe(200);
		await push(alice, [
			{
				mutation_id: id(),
				created_at: 1,
				type: "habit.update",
				habit_id: habit.id,
				changes: { name: "Ler 20 páginas" },
			},
		]);
		const [stored] = await db
			.select()
			.from(habits)
			.where(eq(habits.id, habit.id));
		expect(stored?.name).toBe("Ler 20 páginas");
		expect(stored?.archived_at).toBe(Date.parse(NOW));
	});

	it("rejects bad mutations permanently, one by one, and applies the rest", async () => {
		const good = setMutation(true);
		const results = await push(alice, [
			// Unknown habit and another user's habit look the same.
			setMutation(true, { habit_id: id() }),
			setMutation(true, { habit_id: bobHabit.id }),
			// Outside [today - 7, today + 1].
			setMutation(true, { date: "2026-10-01" }),
			setMutation(true, { date: "2026-10-11" }),
			// Invalid shape and a type this server does not know.
			{ mutation_id: id(), type: "completion.set", date: "nope" },
			{ mutation_id: id(), type: "habit.explode" },
			// A habit id that belongs to someone else.
			{
				mutation_id: id(),
				created_at: 1,
				type: "habit.create",
				id: bobHabit.id,
				name: "x",
				schedule: EVERY_DAY,
				start_date: TODAY,
			},
			good,
		]);
		expect(
			results.map((r) => (r.status === "rejected" ? r.error?.code : r.status))
		).toEqual([
			"not_found",
			"not_found",
			"date_out_of_range",
			"date_out_of_range",
			"validation_error",
			"validation_error",
			"conflict",
			"applied",
		]);
		expect(results[2]?.error?.details).toEqual({
			from: "2026-10-02",
			to: "2026-10-10",
		});
		// Bob's data is untouched.
		expect(await storedCompletions(bobHabit.id)).toEqual([]);
	});

	it("does not remember rejections: a retry is evaluated again", async () => {
		const early = setMutation(true, { date: "2026-10-10" });
		api.setNow("2026-10-08T15:00:00Z"); // today = 10-08: 10-10 is too far ahead
		expect((await push(alice, [early]))[0]?.status).toBe("rejected");
		api.setNow(NOW);
		expect((await push(alice, [early]))[0]?.status).toBe("applied");
	});

	it("gives a fresh id when the proposed completion id is another user's", async () => {
		const [bobResult] = await push(bob, [
			setMutation(true, { habit_id: bobHabit.id }),
		]);
		const taken = bobResult!.canonical_id!;
		const [result] = await push(alice, [setMutation(true, { id: taken })]);
		expect(result?.status).toBe("applied");
		expect(result?.canonical_id).not.toBe(taken);
		expect((await storedCompletions())[0]?.id).toBe(result?.canonical_id);
	});

	it(`accepts up to ${SYNC_PUSH_MAX_MUTATIONS} mutations and rejects bigger batches`, async () => {
		const max = Array.from({ length: SYNC_PUSH_MAX_MUTATIONS }, (_, i) =>
			setMutation(i % 2 === 0)
		);
		const results = await push(alice, max);
		expect(results).toHaveLength(SYNC_PUSH_MAX_MUTATIONS);
		expect(new Set(results.map((r) => r.status))).toEqual(new Set(["applied"]));
		const tooMany = await pushRaw(alice, [...max, setMutation(true)]);
		expect(tooMany.status).toBe(422);
	});

	it("writes a full batch of distinct records within the D1 statement limits", async () => {
		const many: Mutation[] = [];
		for (let i = 0; i < 30; i++) {
			const habitId = id();
			many.push({
				mutation_id: id(),
				created_at: 1,
				type: "habit.create",
				id: habitId,
				name: `Hábito ${i}`,
				schedule: EVERY_DAY,
				start_date: TODAY,
			});
			many.push(setMutation(true, { habit_id: habitId }));
			many.push(setMutation(true, { habit_id: habitId, date: "2026-10-08" }));
		}
		const results = await push(alice, many);
		expect(results.every((r) => r.status === "applied")).toBe(true);
		const rows = await db
			.select({ n: sql<number>`count(*)` })
			.from(completions)
			.where(eq(completions.user_id, alice.id));
		expect(rows[0]?.n).toBe(60);
	});

	it("refuses a newer protocol and requires a session", async () => {
		const newer = await api.request(
			"/v1/sync/push",
			json(
				{ protocol: 99, mutations: [] },
				{ method: "POST", headers: alice.auth() }
			)
		);
		expect(newer.status).toBe(422);
		const anonymous = await api.request(
			"/v1/sync/push",
			json({ protocol: 1, mutations: [] }, { method: "POST" })
		);
		expect(anonymous.status).toBe(401);
	});
});

describe("GET /v1/sync/pull", () => {
	it("returns everything without a cursor, tombstones included", async () => {
		const mark = setMutation(true);
		await push(alice, [
			mark,
			setMutation(false, { id: (mark as { id: string }).id }),
		]);
		const { pages } = await pullAll(alice);
		const completionsPulled = pages.flatMap((p) => p.changes.completions);
		expect(pages.flatMap((p) => p.changes.habits)).toEqual([habit]);
		expect(completionsPulled).toHaveLength(1);
		expect(completionsPulled[0]?.deleted_at).not.toBeNull();
		expect(pages.at(-1)?.remaining).toBe(0);
	});

	it("pages without skipping or repeating, even for writes in the same millisecond", async () => {
		// One batch: many rows written at the same instant.
		await push(
			alice,
			Array.from({ length: 7 }, (_, i) =>
				setMutation(true, {
					habit_id: habit.id,
					date: `2026-10-0${i + 2}`,
				})
			)
		);
		const { pages } = await pullAll(alice, undefined, 2);
		const ids = recordIds(pages);
		expect(ids).toHaveLength(8); // the habit + 7 completions
		expect(new Set(ids).size).toBe(8);
		expect(pages.map((p) => p.remaining)).toEqual([6, 4, 2, 0]);
	});

	it("does not skip writes made between pages; an updated record comes back once more", async () => {
		await push(
			alice,
			["2026-10-05", "2026-10-06", "2026-10-07"].map((date) =>
				setMutation(true, { date })
			)
		);
		const first = await pull(alice, undefined, 2);
		// Meanwhile another device writes (REST and sync both feed the cursor).
		await api.request(
			`/v1/habits/${habit.id}/completions/2026-10-08`,
			json({ completed: true }, { method: "PUT", headers: alice.auth() })
		);
		await push(alice, [setMutation(false, { date: "2026-10-05" })]);
		const rest = await pullAll(alice, first.cursor, 2);
		const ids = recordIds([first, ...rest.pages]);
		const all = await storedCompletions();
		// Every record arrives; the one changed after it was pulled arrives again.
		expect(new Set(ids)).toEqual(new Set([habit.id, ...all.map((c) => c.id)]));
		const oct5 = all.find((c) => c.date === "2026-10-05")!;
		expect(ids.filter((value) => value === oct5.id)).toHaveLength(2);
		expect(
			rest.pages
				.flatMap((p) => p.changes.completions)
				.find((c) => c.id === oct5.id)?.deleted_at
		).not.toBeNull();
		// Caught up: nothing new.
		expect(recordIds((await pullAll(alice, rest.cursor)).pages)).toEqual([]);
	});

	it("only ever returns the user's own records (no push data)", async () => {
		await push(bob, [setMutation(true, { habit_id: bobHabit.id })]);
		await api.request(
			"/v1/push/subscriptions",
			json(
				{ kind: "expo", token: "ExponentPushToken[secret]" },
				{ method: "POST", headers: bob.auth() }
			)
		);
		const { pages } = await pullAll(bob);
		const body = JSON.stringify(pages);
		expect(recordIds(pages)).not.toContain(habit.id);
		expect(body).not.toContain("ExponentPushToken");
		expect(Object.keys(pages[0]!.changes)).toEqual(["habits", "completions"]);
		expect(recordIds((await pullAll(alice)).pages)).toEqual([habit.id]);
	});

	it("asks for a reset on unknown cursors and cursors from the future", async () => {
		expect((await pull(alice, "garbage")).reset).toBe(true);
		expect((await pull(alice, "1.999999")).reset).toBe(true);
		const ok = await pull(alice);
		expect(ok.reset).toBeUndefined();
		expect(decodeCursor(ok.cursor)).toBeGreaterThan(0);
	});
});

describe("tombstone purge", () => {
	const DAY = 24 * 60 * 60_000;

	it("runs once a day, at 06:00 UTC", () => {
		expect(isPurgeRun(Date.parse("2026-10-09T06:00:00Z"))).toBe(true);
		expect(isPurgeRun(Date.parse("2026-10-09T06:14:59Z"))).toBe(true);
		expect(isPurgeRun(Date.parse("2026-10-09T06:15:00Z"))).toBe(false);
		expect(isPurgeRun(Date.parse("2026-10-09T05:45:00Z"))).toBe(false);
	});

	it("removes old tombstones and mutation ids; older cursors must reset", async () => {
		const mark = setMutation(true);
		const markId = (mark as { id: string }).id;
		await push(alice, [mark, setMutation(false, { id: markId })]);
		const { cursor: oldCursor } = await pullAll(alice);
		// A later write, so the device that pulled it has a newer cursor.
		await push(alice, [setMutation(true, { date: "2026-10-08" })]);
		const { cursor: newCursor } = await pullAll(alice, oldCursor);
		// Simulate an older device whose cursor predates the tombstone.
		const beforeTombstone = `1.${decodeCursor(oldCursor)! - 1}`;

		const purgeAt = Date.parse(NOW) + 91 * DAY;
		const purgeRun = purgeAt - (purgeAt % DAY) + 6 * 60 * 60_000;
		await runSyncPurge({ db, now: purgeRun });

		expect((await storedCompletions()).map((c) => c.id)).not.toContain(markId);
		expect(
			await db
				.select()
				.from(processedMutations)
				.where(eq(processedMutations.user_id, alice.id))
		).toEqual([]);
		expect((await pull(alice, beforeTombstone)).reset).toBe(true);
		// Devices already past the purged tombstone keep going.
		expect((await pull(alice, newCursor)).reset).toBeUndefined();
	});

	it("keeps recent tombstones", async () => {
		const mark = setMutation(true);
		await push(alice, [
			mark,
			setMutation(false, { id: (mark as { id: string }).id }),
		]);
		await runSyncPurge({ db, now: Date.parse("2026-10-10T06:00:00Z") });
		expect(await storedCompletions()).toHaveLength(1);
	});
});

describe("migration 0004 backfill", () => {
	it("numbers existing rows per user, so the first pull gets them all", async () => {
		await push(alice, [
			setMutation(true),
			setMutation(true, { date: "2026-10-08" }),
		]);
		// Rows as they were before the migration: no seq, no sync_state.
		await db.batch([
			db.update(habits).set({ server_seq: 0 }),
			db.update(completions).set({ server_seq: 0 }),
			db.delete(syncState),
		]);
		const migration = env.TEST_MIGRATIONS.find((m) =>
			m.name.startsWith("0004")
		)!;
		const backfill = migration.queries.filter((query) =>
			/^\s*(?:--[^\n]*\n\s*)*(UPDATE|INSERT INTO `sync_state`)/.test(query)
		);
		expect(backfill).toHaveLength(3);
		for (const query of backfill) await env.DB.prepare(query).run();

		const seqs = [
			...(await db
				.select({ seq: habits.server_seq })
				.from(habits)
				.where(eq(habits.user_id, alice.id))),
			...(await db
				.select({ seq: completions.server_seq })
				.from(completions)
				.where(eq(completions.user_id, alice.id))),
		]
			.map((row) => row.seq)
			.sort((a, b) => a - b);
		expect(seqs).toEqual([1, 2, 3]);
		const [state] = await db
			.select()
			.from(syncState)
			.where(and(eq(syncState.user_id, alice.id)));
		expect(state?.seq).toBe(3);
		expect(recordIds((await pullAll(alice)).pages)).toHaveLength(3);
		// The triggers continue from there.
		await push(alice, [setMutation(false)]);
		const [after] = await db
			.select()
			.from(syncState)
			.where(eq(syncState.user_id, alice.id));
		expect(after?.seq).toBe(4);
	});
});
