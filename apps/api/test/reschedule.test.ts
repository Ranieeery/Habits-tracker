// Postponing one occurrence (2.16.0): REST, the core rules, concurrency,
// sync (offline action date, two devices), views, the cron, the purge and
// older clients.
import {
	Completion,
	SCHEDULE_VERSION,
	SCHEDULE_VERSION_HEADER,
	type DayResponse,
	Habit,
	type HabitReschedule,
	type SummaryResponse,
	type SyncPullResponse,
	type SyncPushResponse,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { runSyncPurge } from "../src/cron/sync-purge.ts";
import { habitReschedules, syncState } from "../src/db/schema.ts";
import { uuidV7 } from "../src/lib/ids.ts";
import { runScheduled } from "../src/scheduled.ts";
import {
	createUser,
	db,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";
import { fakePushFetch } from "./push-fakes.ts";

const TODAY = "2026-10-20";
/** A São Paulo wall-clock instant as ISO. */
const at = (date: string, time = "12:00") =>
	new Date(Date.parse(`${date}T${time}:00-03:00`)).toISOString();
const NOW_MS = Date.parse(at(TODAY));
const DAY = 24 * 60 * 60_000;
const MONTHLY = { type: "monthly_days" as const, days: [20] };
const EVERY_DAY = { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] };

let api: TestApi;
let alice: TestUser;
let bob: TestUser;
let counter = 0;
const id = () => uuidV7(NOW_MS + ++counter);

beforeEach(async () => {
	await resetDb();
	api = makeApi(at(TODAY), { ALLOW_SIGNUP: "true" });
	alice = await createUser(api, "alice@example.com");
	bob = await createUser(api, "bob@example.com");
});

async function createHabit(
	user: TestUser,
	name: string,
	schedule: unknown = MONTHLY,
	startDate = TODAY
): Promise<Habit> {
	const response = await api.request(
		"/v1/habits",
		json(
			{ name, schedule, start_date: startDate },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: Habit }).habit;
}

function postpone(
	user: TestUser,
	habitId: string,
	body: {
		id?: string;
		original_date?: string;
		from_date?: string;
		to_date: string;
		sequence?: number;
	}
) {
	return api.request(
		`/v1/habits/${habitId}/reschedules`,
		json(
			{
				id: body.id ?? id(),
				original_date: body.original_date ?? TODAY,
				from_date: body.from_date ?? body.original_date ?? TODAY,
				to_date: body.to_date,
				sequence: body.sequence ?? 1,
			},
			{ method: "POST", headers: user.auth() }
		)
	);
}
const undo = (user: TestUser, habitId: string, rescheduleId: string) =>
	api.request(`/v1/habits/${habitId}/reschedules/${rescheduleId}`, {
		method: "DELETE",
		headers: user.auth(),
	});
const rowOf = async (response: Response) =>
	((await response.json()) as { reschedule: HabitReschedule }).reschedule;
const errorOf = async (response: Response) =>
	((await response.json()) as { error: { code: string; details?: unknown } })
		.error;

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
const mark = (user: TestUser, habitId: string, date: string) =>
	api.request(
		`/v1/habits/${habitId}/completions/${date}`,
		json({ completed: true }, { method: "PUT", headers: user.auth() })
	);

describe("REST", () => {
	it("moves the occurrence: no failure on O, possible on N, idempotent per id", async () => {
		const ler = await createHabit(alice, "Ler", EVERY_DAY);
		const conta = await createHabit(alice, "Pagar conta");
		await mark(alice, ler.id, TODAY);
		const rescheduleId = id();
		const created = await postpone(alice, conta.id, {
			id: rescheduleId,
			to_date: "2026-10-27",
		});
		expect(created.status).toBe(201);
		expect(await rowOf(created)).toMatchObject({
			id: rescheduleId,
			habit_id: conta.id,
			original_date: TODAY,
			from_date: TODAY,
			to_date: "2026-10-27",
			sequence: 1,
			deleted_at: null,
		});
		const again = await postpone(alice, conta.id, {
			id: rescheduleId,
			to_date: "2026-10-27",
		});
		expect(again.status).toBe(200);

		const onO = await day(alice, TODAY);
		expect(onO.possible_habits.map((h) => h.id)).toEqual([ler.id]);
		expect(onO.moved_out).toEqual([
			{
				habit: expect.objectContaining({ id: conta.id }),
				to_date: "2026-10-27",
			},
		]);
		const onN = await day(alice, "2026-10-27");
		expect(onN.possible_habits.map((h) => h.id)).toContain(conta.id);
		expect(onN.moved_in).toEqual([
			{ habit_id: conta.id, original_date: TODAY, count: 1 },
		]);
		expect((await summary(alice)).days.find((d) => d.date === TODAY)).toEqual({
			date: TODAY,
			possible: 1,
			completed: 1,
		});

		const list = await api.request("/v1/reschedules", {
			headers: alice.auth(),
		});
		const body = await list.text();
		expect(JSON.parse(body).reschedules).toHaveLength(1);
		expect(body).not.toMatch(/endpoint|p256dh|ExponentPushToken/);
	});

	it("validates with the core rules", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const today = await postpone(alice, conta.id, { to_date: TODAY });
		expect(today.status).toBe(422);
		expect(await errorOf(today)).toMatchObject({
			code: "validation_error",
			details: { reason: "not_later" },
		});
		const next = await postpone(alice, conta.id, { to_date: "2026-11-20" });
		expect(next.status).toBe(422);
		expect(await errorOf(next)).toMatchObject({
			code: "date_out_of_range",
			details: { reason: "crosses_next", latest: "2026-11-19" },
		});
		const consulta = await createHabit(alice, "Consulta", {
			type: "once",
			date: TODAY,
		});
		const far = await postpone(alice, consulta.id, { to_date: "2027-01-19" });
		expect(await errorOf(far)).toMatchObject({
			details: { reason: "too_far", latest: "2027-01-18" },
		});
		expect(
			(await postpone(alice, consulta.id, { to_date: "2027-01-18" })).status
		).toBe(201);
		const weekly = await createHabit(alice, "Ler", EVERY_DAY);
		expect(
			await errorOf(await postpone(alice, weekly.id, { to_date: "2026-10-22" }))
		).toMatchObject({ details: { reason: "not_reschedulable" } });
	});

	it("at most two; a stale or third one is a conflict; an undo gives the slot back", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const first = await rowOf(
			await postpone(alice, conta.id, { to_date: "2026-10-22" })
		);
		const stale = await postpone(alice, conta.id, { to_date: "2026-10-23" });
		expect(stale.status).toBe(409);
		const second = await rowOf(
			await postpone(alice, conta.id, {
				from_date: "2026-10-22",
				to_date: "2026-10-25",
				sequence: 2,
			})
		);
		const third = await postpone(alice, conta.id, {
			from_date: "2026-10-25",
			to_date: "2026-10-27",
			sequence: 3,
		});
		expect(third.status).toBe(409);
		expect(await errorOf(third)).toMatchObject({
			details: { reason: "limit_reached" },
		});

		expect((await undo(alice, conta.id, first.id)).status).toBe(409);
		const undone = await undo(alice, conta.id, second.id);
		expect(undone.status).toBe(200);
		expect((await rowOf(undone)).deleted_at).toBe(NOW_MS);
		expect((await undo(alice, conta.id, second.id)).status).toBe(200);
		expect(
			(
				await postpone(alice, conta.id, {
					from_date: "2026-10-22",
					to_date: "2026-10-28",
					sequence: 2,
				})
			).status
		).toBe(201);
	});

	it("two simultaneous requests for one occurrence: one applies, the other is 409", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const statuses = (
			await Promise.all([
				postpone(alice, conta.id, { to_date: "2026-10-25" }),
				postpone(alice, conta.id, { to_date: "2026-10-26" }),
			])
		).map((r) => r.status);
		expect(statuses.sort()).toEqual([201, 409]);
		const rows = await db
			.select()
			.from(habitReschedules)
			.where(eq(habitReschedules.habit_id, conta.id));
		expect(rows).toHaveLength(1);
	});

	it("undo is refused once the previous date went by", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const row = await rowOf(
			await postpone(alice, conta.id, { to_date: "2026-10-27" })
		);
		api.setNow(at("2026-10-21"));
		const late = await undo(alice, conta.id, row.id);
		expect(late.status).toBe(422);
		expect(await errorOf(late)).toMatchObject({
			details: { reason: "undo_passed" },
		});
	});

	it("is scoped by user", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const row = await rowOf(
			await postpone(alice, conta.id, { to_date: "2026-10-27" })
		);
		expect(
			(await postpone(bob, conta.id, { to_date: "2026-10-28" })).status
		).toBe(404);
		expect((await undo(bob, conta.id, row.id)).status).toBe(404);
		const bobs = await api.request("/v1/reschedules", { headers: bob.auth() });
		expect(await bobs.json()).toEqual({ reschedules: [], completions: [] });
		expect((await day(bob, "2026-10-27")).possible_habits).toEqual([]);
	});

	it("a completion between O and E fulfills the occurrence early", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		await postpone(alice, conta.id, { to_date: "2026-10-27" });
		api.setNow(at("2026-10-22"));
		await mark(alice, conta.id, "2026-10-22");
		const onN = await day(alice, "2026-10-27");
		expect(onN.possible_habits).toEqual([]);
		api.setNow(at("2026-10-28"));
		expect((await day(alice, "2026-10-28")).overdue).toEqual([]);
	});

	it("a missed N is overdue from N + 1, with the nominal date", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		await postpone(alice, conta.id, { to_date: "2026-10-27" });
		api.setNow(at("2026-10-28"));
		expect((await day(alice, "2026-10-28")).overdue).toEqual([
			{
				habit: expect.objectContaining({ id: conta.id }),
				since: "2026-10-27",
				completed_today: false,
				rescheduled_from: TODAY,
			},
		]);
		const days = (await summary(alice)).days;
		expect(days.find((d) => d.date === TODAY)).toBeUndefined();
		expect(days.find((d) => d.date === "2026-10-27")).toEqual({
			date: "2026-10-27",
			possible: 1,
			completed: 0,
		});
	});
});

describe("sync", () => {
	async function push(user: TestUser, mutations: unknown[]) {
		const response = await api.request(
			"/v1/sync/push",
			json({ protocol: 1, mutations }, { method: "POST", headers: user.auth() })
		);
		return response;
	}
	async function results(user: TestUser, mutations: unknown[]) {
		const response = await push(user, mutations);
		expect(response.status).toBe(200);
		return ((await response.json()) as SyncPushResponse).results;
	}
	async function pull(user: TestUser, cursor?: string) {
		const query = cursor ? `?cursor=${cursor}` : "";
		// The apps since 2.13.0 send the schedule version (monthly habits are
		// hidden from clients without it).
		const response = await api.request(`/v1/sync/pull${query}`, {
			headers: {
				...user.auth(),
				[SCHEDULE_VERSION_HEADER]: String(SCHEDULE_VERSION),
			},
		});
		expect(response.status).toBe(200);
		return (await response.json()) as SyncPullResponse;
	}
	const create = (
		habitId: string,
		overrides: Record<string, unknown> = {}
	) => ({
		mutation_id: id(),
		created_at: NOW_MS,
		type: "reschedule.create",
		id: id(),
		habit_id: habitId,
		original_date: TODAY,
		from_date: TODAY,
		to_date: "2026-10-27",
		sequence: 1,
		action_date: TODAY,
		...overrides,
	});

	it("applies once per mutation_id and delivers the row in the pull", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const { cursor } = await pull(alice);
		const mutation = create(conta.id);
		const [applied] = await results(alice, [mutation]);
		expect(applied).toMatchObject({
			status: "applied",
			canonical_id: mutation.id,
		});
		const [duplicate] = await results(alice, [mutation]);
		expect(duplicate).toMatchObject({ status: "duplicate" });
		const page = await pull(alice, cursor);
		expect(page.changes.reschedules).toEqual([
			expect.objectContaining({ id: mutation.id, to_date: "2026-10-27" }),
		]);
		const [undone] = await results(alice, [
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "reschedule.undo",
				habit_id: conta.id,
				reschedule_id: mutation.id,
				action_date: TODAY,
			},
		]);
		expect(undone?.status).toBe("applied");
		const next = await pull(alice, page.cursor);
		expect(next.changes.reschedules[0]?.deleted_at).toBe(NOW_MS);
	});

	it("an offline postponement is checked against the day it was made", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		api.setNow(at("2026-10-21"));
		const [late] = await results(alice, [create(conta.id)]);
		expect(late?.status).toBe("applied");
		expect((await day(alice, TODAY)).possible_habits).toEqual([]);

		const other = await createHabit(
			alice,
			"Consulta",
			{ type: "once", date: "2026-10-21" },
			"2026-10-21"
		);
		api.setNow(at("2026-11-25"));
		const [outside] = await results(alice, [
			create(other.id, {
				original_date: "2026-10-21",
				from_date: "2026-10-21",
				to_date: "2026-10-28",
				action_date: "2026-10-21",
			}),
		]);
		expect(outside).toMatchObject({
			status: "rejected",
			error: { code: "date_out_of_range" },
		});
	});

	it("two devices postponing the same occurrence: one applies, the other is a conflict", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const phone = create(conta.id);
		const tablet = create(conta.id, { to_date: "2026-10-30" });
		const responses = await Promise.all([
			push(alice, [phone]),
			push(alice, [tablet]),
		]);
		// A push that lost the race on the unique index fails as a whole
		// (transient); the app retries it.
		const outcomes: string[] = [];
		for (const [index, response] of responses.entries()) {
			const retried =
				response.status === 200
					? response
					: await push(alice, [index === 0 ? phone : tablet]);
			const [result] = ((await retried.json()) as SyncPushResponse).results;
			outcomes.push(
				result!.status === "rejected"
					? (result!.error!.code as string)
					: result!.status
			);
		}
		expect(outcomes.sort()).toEqual(["applied", "conflict"]);
		const rows = await db
			.select()
			.from(habitReschedules)
			.where(eq(habitReschedules.habit_id, conta.id));
		expect(rows).toHaveLength(1);
	});

	it("rejects another user's habit as not_found and a third one as a conflict", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const [foreign] = await results(bob, [create(conta.id)]);
		expect(foreign).toMatchObject({
			status: "rejected",
			error: { code: "not_found" },
		});
		const first = create(conta.id, { to_date: "2026-10-22" });
		const second = create(conta.id, {
			from_date: "2026-10-22",
			to_date: "2026-10-24",
			sequence: 2,
		});
		const third = create(conta.id, {
			from_date: "2026-10-24",
			to_date: "2026-10-26",
			sequence: 3,
		});
		const outcomes = await results(alice, [first, second, third]);
		expect(outcomes.map((r) => r.status)).toEqual([
			"applied",
			"applied",
			"rejected",
		]);
		expect(outcomes[2]?.error).toMatchObject({
			code: "conflict",
			details: { reason: "limit_reached" },
		});
	});

	it("an older app (2.15.0 contracts) reads the pull without the new key", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		await results(alice, [create(conta.id)]);
		const Old = z.object({
			cursor: z.string(),
			has_more: z.boolean(),
			changes: z.object({
				habits: z.array(Habit),
				completions: z.array(Completion),
			}),
		});
		const page = Old.parse(await pull(alice));
		expect(page.changes).not.toHaveProperty("reschedules");
		expect(page.changes.habits.map((h) => h.id)).toEqual([conta.id]);
	});

	it("each write takes the user's next server_seq (migration 0008 triggers)", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const [before] = await db
			.select()
			.from(syncState)
			.where(eq(syncState.user_id, alice.id));
		await postpone(alice, conta.id, { to_date: "2026-10-27" });
		const [after] = await db
			.select()
			.from(syncState)
			.where(eq(syncState.user_id, alice.id));
		expect(after!.seq).toBe(before!.seq + 1);
		const [row] = await db
			.select()
			.from(habitReschedules)
			.where(eq(habitReschedules.habit_id, conta.id));
		expect(row!.server_seq).toBe(after!.seq);
	});
});

describe("purge", () => {
	const purgeRunAt = (ms: number) => ms - (ms % DAY) + 6 * 60 * 60_000;

	it("removes undone postponements after 90 days and keeps live ones forever", async () => {
		const conta = await createHabit(alice, "Pagar conta");
		const consulta = await createHabit(alice, "Consulta", {
			type: "once",
			date: TODAY,
		});
		const undone = await rowOf(
			await postpone(alice, conta.id, { to_date: "2026-10-27" })
		);
		await undo(alice, conta.id, undone.id);
		await postpone(alice, consulta.id, { to_date: "2026-10-27" });

		await runSyncPurge({ db, now: purgeRunAt(NOW_MS + 91 * DAY) });
		const rows = await db
			.select()
			.from(habitReschedules)
			.where(eq(habitReschedules.user_id, alice.id));
		expect(rows.map((r) => r.habit_id)).toEqual([consulta.id]);
		const [state] = await db
			.select()
			.from(syncState)
			.where(eq(syncState.user_id, alice.id));
		expect(state!.purged_seq).toBeGreaterThan(0);
	});
});

describe("notifications follow the effective date", () => {
	async function setupReminder(day: string) {
		const remindApi = makeApi(at(TODAY), { ALLOW_SIGNUP: "true" });
		const owner = await createUser(remindApi, "owner@example.com");
		await remindApi.request(
			"/v1/settings",
			json(
				{ reminder_time: "20:00" },
				{ method: "PATCH", headers: owner.auth() }
			)
		);
		const created = await remindApi.request(
			"/v1/habits",
			json(
				{ name: "Pagar conta", schedule: MONTHLY, start_date: TODAY },
				{ method: "POST", headers: owner.auth() }
			)
		);
		const { habit } = (await created.json()) as { habit: Habit };
		const moved = await remindApi.request(
			`/v1/habits/${habit.id}/reschedules`,
			json(
				{
					id: id(),
					original_date: TODAY,
					from_date: TODAY,
					to_date: "2026-10-27",
					sequence: 1,
				},
				{ method: "POST", headers: owner.auth() }
			)
		);
		expect(moved.status).toBe(201);
		await remindApi.request(
			"/v1/push/subscriptions",
			json(
				{ kind: "expo", token: "ExponentPushToken[reschedule]" },
				{ method: "POST", headers: owner.auth() }
			)
		);
		const fake = fakePushFetch();
		await runScheduled({
			env: env as Env,
			now: Date.parse(at(day, "20:15")),
			fetch: fake.fetch,
		});
		const sent = fake.expoSends().flat();
		return {
			reminders: sent.filter(
				(m) => (m.data as { kind?: string }).kind === "reminder"
			),
		};
	}

	it("no reminder on O, a reminder on N", async () => {
		expect((await setupReminder(TODAY)).reminders).toHaveLength(0);
		await resetDb();
		expect((await setupReminder("2026-10-27")).reminders).toHaveLength(1);
	});

	it("the 09:00 digest names it on N, not on O", async () => {
		const digestApi = makeApi(at(TODAY, "08:00"), { ALLOW_SIGNUP: "true" });
		const owner = await createUser(digestApi, "owner@example.com");
		const created = await digestApi.request(
			"/v1/habits",
			json(
				{ name: "Pagar conta", schedule: MONTHLY, start_date: TODAY },
				{ method: "POST", headers: owner.auth() }
			)
		);
		const { habit } = (await created.json()) as { habit: Habit };
		await digestApi.request(
			`/v1/habits/${habit.id}/reschedules`,
			json(
				{
					id: id(),
					original_date: TODAY,
					from_date: TODAY,
					to_date: "2026-10-27",
					sequence: 1,
				},
				{ method: "POST", headers: owner.auth() }
			)
		);
		await digestApi.request(
			"/v1/push/subscriptions",
			json(
				{ kind: "expo", token: "ExponentPushToken[digest]" },
				{ method: "POST", headers: owner.auth() }
			)
		);
		const run = async (date: string) => {
			const fake = fakePushFetch();
			await runScheduled({
				env: env as Env,
				now: Date.parse(at(date, "09:00")),
				fetch: fake.fetch,
			});
			return fake
				.expoSends()
				.flat()
				.filter((m) => (m.data as { kind?: string }).kind === "digest");
		};
		expect(await run(TODAY)).toEqual([]);
		const onN = await run("2026-10-27");
		expect(onN).toHaveLength(1);
		expect(onN[0]?.body).toContain("Pagar conta");
	});
});
