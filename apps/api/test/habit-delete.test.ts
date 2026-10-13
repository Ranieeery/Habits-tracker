// Deleting and restoring habits (2.11.0): REST, sync, user scope, history,
// the purge and the notification cron.
import type {
	DayResponse,
	Habit,
	MutationResult,
	SummaryResponse,
	SyncPullResponse,
	SyncPushResponse,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { runSyncPurge } from "../src/cron/sync-purge.ts";
import { completions, habits, syncState } from "../src/db/schema.ts";
import { uuidV7 } from "../src/lib/ids.ts";
import { decodeCursor } from "../src/routes/sync.ts";
import { runScheduled } from "../src/scheduled.ts";
import { fakePushFetch } from "./push-fakes.ts";
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
const NOW_MS = Date.parse(NOW);
const EVERY_DAY = { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] };
const DAY = 24 * 60 * 60_000;

let api: TestApi;
let alice: TestUser;
let bob: TestUser;

const id = () => uuidV7(NOW_MS);

beforeEach(async () => {
	await resetDb();
	api = makeApi(NOW, { ALLOW_SIGNUP: "true" });
	alice = await createUser(api, "alice@example.com");
	bob = await createUser(api, "bob@example.com");
});

async function createHabit(
	user: TestUser,
	name: string,
	startDate = "2026-10-01"
): Promise<Habit> {
	const response = await api.request(
		"/v1/habits",
		json(
			{ name, schedule: EVERY_DAY, start_date: startDate },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: Habit }).habit;
}

const patch = (user: TestUser, habitId: string, body: unknown) =>
	api.request(
		`/v1/habits/${habitId}`,
		json(body, { method: "PATCH", headers: user.auth() })
	);
const archive = async (user: TestUser, habitId: string) =>
	expect((await patch(user, habitId, { archived: true })).status).toBe(200);
const del = (user: TestUser, habitId: string) =>
	api.request(`/v1/habits/${habitId}`, {
		method: "DELETE",
		headers: user.auth(),
	});
const restore = (user: TestUser, habitId: string) =>
	api.request(`/v1/habits/${habitId}/restore`, {
		method: "POST",
		headers: user.auth(),
	});
const mark = (
	user: TestUser,
	habitId: string,
	date: string,
	completed = true
) =>
	api.request(
		`/v1/habits/${habitId}/completions/${date}`,
		json({ completed }, { method: "PUT", headers: user.auth() })
	);

const habitOf = async (response: Response) =>
	((await response.json()) as { habit: Habit }).habit;

async function list(user: TestUser): Promise<Habit[]> {
	const response = await api.request("/v1/habits", { headers: user.auth() });
	return ((await response.json()) as { habits: Habit[] }).habits;
}
async function day(user: TestUser, date: string): Promise<DayResponse> {
	const response = await api.request(`/v1/day?date=${date}`, {
		headers: user.auth(),
	});
	expect(response.status).toBe(200);
	return (await response.json()) as DayResponse;
}
async function summary(user: TestUser): Promise<SummaryResponse> {
	const response = await api.request("/v1/summary?year=2026", {
		headers: user.auth(),
	});
	expect(response.status).toBe(200);
	return (await response.json()) as SummaryResponse;
}

/** Two daily habits since 01/10, both done on 05/10; "Ler" archived. */
async function setupHistory() {
	const ler = await createHabit(alice, "Ler");
	const correr = await createHabit(alice, "Correr");
	expect((await mark(alice, ler.id, "2026-10-05")).status).toBe(200);
	expect((await mark(alice, correr.id, "2026-10-05")).status).toBe(200);
	await archive(alice, ler.id);
	return { ler, correr };
}

describe("DELETE /v1/habits/{habit_id}", () => {
	it("deletes an archived habit: gone from the list, past days and the summary", async () => {
		const { ler, correr } = await setupHistory();
		const before = await summary(alice);
		const oct5 = before.days.find((d) => d.date === "2026-10-05");
		expect(oct5).toMatchObject({ possible: 2, completed: 2 });

		const response = await del(alice, ler.id);

		expect(response.status).toBe(200);
		const deleted = await habitOf(response);
		expect(deleted).toMatchObject({
			id: ler.id,
			name: "Ler",
			sort_key: ler.sort_key,
			deleted_at: NOW_MS,
			updated_at: NOW_MS,
		});
		expect(deleted.archived_at).not.toBeNull();
		expect((await list(alice)).map((h) => h.id)).toEqual([correr.id]);
		const past = await day(alice, "2026-10-05");
		expect(past.possible_habits.map((h) => h.id)).toEqual([correr.id]);
		expect(past.completed_habit_ids).toEqual([correr.id]);
		const after = await summary(alice);
		expect(after.days.find((d) => d.date === "2026-10-05")).toMatchObject({
			possible: 1,
			completed: 1,
		});
	});

	it("refuses a habit that is not archived (409) and changes nothing", async () => {
		const ler = await createHabit(alice, "Ler");

		const response = await del(alice, ler.id);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: "conflict",
				message: "Habit must be archived before deleting",
			},
		});
		expect(await list(alice)).toEqual([ler]);
	});

	it("is idempotent: deleting twice keeps the first deleted_at", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		const first = await habitOf(await del(alice, ler.id));

		api.setNow("2026-10-09T16:00:00Z");
		const second = await del(alice, ler.id);

		expect(second.status).toBe(200);
		expect(await habitOf(second)).toEqual(first);
	});

	it("answers 404 for an unknown habit or another user's, which stays intact", async () => {
		const bobs = await createHabit(bob, "Correr");
		await archive(bob, bobs.id);
		const [bobBefore] = await list(bob);

		expect((await del(alice, bobs.id)).status).toBe(404);
		expect((await restore(alice, bobs.id)).status).toBe(404);
		expect((await del(alice, id())).status).toBe(404);
		expect((await restore(alice, id())).status).toBe(404);
		expect(await list(bob)).toEqual([bobBefore]);

		// And bob's deleted habit cannot be restored by alice either.
		expect((await del(bob, bobs.id)).status).toBe(200);
		expect((await restore(alice, bobs.id)).status).toBe(404);
		expect(await list(bob)).toEqual([]);
	});

	it("leaves a deleted habit unreachable by PATCH and completions (404)", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		await del(alice, ler.id);

		expect((await patch(alice, ler.id, { name: "Ler mais" })).status).toBe(404);
		expect((await patch(alice, ler.id, { archived: false })).status).toBe(404);
		expect((await mark(alice, ler.id, TODAY)).status).toBe(404);
	});

	it("does not revive a deleted habit through a create with its id", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		await del(alice, ler.id);

		const again = await api.request(
			"/v1/habits",
			json(
				{ id: ler.id, name: "Ler", schedule: EVERY_DAY, start_date: TODAY },
				{ method: "POST", headers: alice.auth() }
			)
		);

		expect(again.status).toBe(409);
		expect(await list(alice)).toEqual([]);
	});

	it("writes one habit row and bumps server_seq once", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		const seqOf = async () =>
			(
				await db.select().from(syncState).where(eq(syncState.user_id, alice.id))
			)[0]!.seq;
		const before = await seqOf();

		await del(alice, ler.id);

		expect(await seqOf()).toBe(before + 1);
	});
});

describe("POST /v1/habits/{habit_id}/restore", () => {
	it("brings the habit back archived, with the same history", async () => {
		const { ler } = await setupHistory();
		const archived = (await list(alice)).find((h) => h.id === ler.id)!;
		const before = await summary(alice);
		await del(alice, ler.id);

		api.setNow("2026-10-09T15:05:00Z");
		const response = await restore(alice, ler.id);

		expect(response.status).toBe(200);
		const restored = await habitOf(response);
		expect(restored).toEqual({
			...archived,
			updated_at: Date.parse("2026-10-09T15:05:00Z"),
		});
		expect(await summary(alice)).toEqual(before);
		expect((await list(alice)).map((h) => h.id)).toContain(ler.id);
	});

	it("returns a live habit unchanged", async () => {
		const ler = await createHabit(alice, "Ler");
		const response = await restore(alice, ler.id);
		expect(response.status).toBe(200);
		expect(await habitOf(response)).toEqual(ler);
	});
});

describe("sync: habit.delete and habit.restore", () => {
	async function push(user: TestUser, mutations: unknown[]) {
		const response = await api.request(
			"/v1/sync/push",
			json({ protocol: 1, mutations }, { method: "POST", headers: user.auth() })
		);
		expect(response.status).toBe(200);
		return ((await response.json()) as SyncPushResponse).results;
	}
	async function pull(user: TestUser, cursor?: string) {
		const query = cursor ? `?cursor=${cursor}` : "";
		const response = await api.request(`/v1/sync/pull${query}`, {
			headers: user.auth(),
		});
		expect(response.status).toBe(200);
		return (await response.json()) as SyncPullResponse;
	}
	const mutation = (
		type: "habit.delete" | "habit.restore",
		habitId: string
	) => ({
		mutation_id: id(),
		created_at: NOW_MS,
		type,
		habit_id: habitId,
	});

	it("applies, deduplicates and delivers the tombstone, then the restored habit", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		const { cursor } = await pull(alice);

		const deletion = mutation("habit.delete", ler.id);
		const [applied] = await push(alice, [deletion]);
		const [duplicate] = await push(alice, [deletion]);

		expect(applied).toEqual<MutationResult>({
			mutation_id: deletion.mutation_id,
			status: "applied",
			canonical_id: ler.id,
		});
		expect(duplicate?.status).toBe("duplicate");
		const afterDelete = await pull(alice, cursor);
		expect(afterDelete.changes.habits).toHaveLength(1);
		expect(afterDelete.changes.habits[0]).toMatchObject({
			id: ler.id,
			deleted_at: NOW_MS,
		});
		expect(await list(alice)).toEqual([]);

		const [restored] = await push(alice, [mutation("habit.restore", ler.id)]);
		expect(restored?.status).toBe("applied");
		const afterRestore = await pull(alice, afterDelete.cursor);
		expect(afterRestore.changes.habits[0]).toMatchObject({
			id: ler.id,
			deleted_at: null,
		});
		expect(decodeCursor(afterRestore.cursor)!).toBeGreaterThan(
			decodeCursor(afterDelete.cursor)!
		);
		expect((await list(alice)).map((h) => h.id)).toEqual([ler.id]);
	});

	it("rejects deleting a habit that is not archived, an unknown or another user's", async () => {
		const ler = await createHabit(alice, "Ler");
		const bobs = await createHabit(bob, "Correr");
		await archive(bob, bobs.id);

		const results = await push(alice, [
			mutation("habit.delete", ler.id),
			mutation("habit.delete", bobs.id),
			mutation("habit.restore", id()),
		]);

		expect(results.map((r) => [r.status, r.error?.code])).toEqual([
			["rejected", "conflict"],
			["rejected", "not_found"],
			["rejected", "not_found"],
		]);
		expect(await list(alice)).toEqual([ler]);
		expect((await list(bob)).map((h) => h.id)).toEqual([bobs.id]);
	});

	it("applies archive and delete of the same habit in one push, and a habit created there", async () => {
		const ler = await createHabit(alice, "Ler");
		const fresh = id();
		const results = await push(alice, [
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.update",
				habit_id: ler.id,
				changes: { archived: true },
			},
			mutation("habit.delete", ler.id),
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.create",
				id: fresh,
				name: "Correr",
				schedule: EVERY_DAY,
				start_date: TODAY,
			},
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.update",
				habit_id: fresh,
				changes: { archived: true },
			},
			mutation("habit.delete", fresh),
		]);

		expect(results.every((r) => r.status === "applied")).toBe(true);
		expect(await list(alice)).toEqual([]);
		const rows = await db
			.select()
			.from(habits)
			.where(eq(habits.user_id, alice.id));
		expect(rows.every((row) => row.deleted_at === NOW_MS)).toBe(true);
	});

	it("keeps rejecting an unknown mutation type alone (what an older API does to a newer app)", async () => {
		const ler = await createHabit(alice, "Ler");
		const results = await push(alice, [
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.erase",
				habit_id: ler.id,
			},
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "completion.set",
				id: id(),
				habit_id: ler.id,
				date: TODAY,
				completed: true,
			},
		]);
		expect(results.map((r) => r.status)).toEqual(["rejected", "applied"]);
		expect(results[0]?.error?.code).toBe("validation_error");
	});

	it("rejects completions of a deleted habit", async () => {
		const ler = await createHabit(alice, "Ler");
		await archive(alice, ler.id);
		await del(alice, ler.id);
		const [result] = await push(alice, [
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "completion.set",
				id: id(),
				habit_id: ler.id,
				date: TODAY,
				completed: true,
			},
		]);
		expect(result?.error?.code).toBe("not_found");
	});
});

describe("purge of deleted habits", () => {
	const purgeRunAt = (ms: number) => ms - (ms % DAY) + 6 * 60 * 60_000;
	const aliceHabits = () =>
		db.select().from(habits).where(eq(habits.user_id, alice.id));
	const aliceCompletions = () =>
		db.select().from(completions).where(eq(completions.user_id, alice.id));

	it("removes a habit deleted more than 90 days ago with its completions", async () => {
		const ler = await createHabit(alice, "Ler");
		await mark(alice, ler.id, "2026-10-05");
		await archive(alice, ler.id);
		await del(alice, ler.id);

		await runSyncPurge({ db, now: purgeRunAt(NOW_MS + 91 * DAY) });

		expect(await aliceHabits()).toEqual([]);
		expect(await aliceCompletions()).toEqual([]);
	});

	it("keeps a recently deleted habit and a restored one", async () => {
		const recent = await createHabit(alice, "Ler");
		const back = await createHabit(alice, "Correr");
		await mark(alice, back.id, "2026-10-05");
		for (const habit of [recent, back]) {
			await archive(alice, habit.id);
			await del(alice, habit.id);
		}
		await restore(alice, back.id);

		await runSyncPurge({ db, now: purgeRunAt(NOW_MS + 30 * DAY) });
		expect(await aliceHabits()).toHaveLength(2);

		await runSyncPurge({ db, now: purgeRunAt(NOW_MS + 91 * DAY) });
		expect((await aliceHabits()).map((h) => h.id)).toEqual([back.id]);
		expect(await aliceCompletions()).toHaveLength(1);
	});
});

describe("notifications ignore deleted habits", () => {
	it("neither the reminder nor the digest counts a deleted habit", async () => {
		const at = "2026-10-09T23:15:00Z"; // 20:15 in São Paulo
		const remindApi = makeApi(at, { ALLOW_SIGNUP: "true" });
		const owner = await createUser(remindApi, "owner@example.com");
		const settings = await remindApi.request(
			"/v1/settings",
			json(
				{ reminder_time: "20:00" },
				{ method: "PATCH", headers: owner.auth() }
			)
		);
		expect(settings.status).toBe(200);
		const created = await remindApi.request(
			"/v1/habits",
			json(
				{ name: "Ler", schedule: EVERY_DAY, start_date: "2026-10-01" },
				{ method: "POST", headers: owner.auth() }
			)
		);
		const { habit } = (await created.json()) as { habit: Habit };
		await remindApi.request(
			`/v1/habits/${habit.id}`,
			json({ archived: true }, { method: "PATCH", headers: owner.auth() })
		);
		await remindApi.request(`/v1/habits/${habit.id}`, {
			method: "DELETE",
			headers: owner.auth(),
		});
		const device = await remindApi.request(
			"/v1/push/subscriptions",
			json(
				{ kind: "expo", token: "ExponentPushToken[deleted-habit]" },
				{ method: "POST", headers: owner.auth() }
			)
		);
		expect(device.status).toBe(200);
		const fake = fakePushFetch();

		const report = await runScheduled({
			env: env as Env,
			now: Date.parse(at),
			fetch: fake.fetch,
		});

		expect(report.usersNotified).toBe(0);
		expect(fake.requests).toHaveLength(0);
	});
});
