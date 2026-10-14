// Deadline tasks (2.13.0): creation rules, user scope, today's "Com prazo"
// and "já concluída", the first completion outside the loaded range, the
// digest and the reminder, the locked due date and older clients.
import {
	type DayResponse,
	type Habit,
	type HabitListResponse,
	SCHEDULE_VERSION_HEADER,
	type SummaryResponse,
	type SyncPullResponse,
	type SyncPushResponse,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { uuidV7 } from "../src/lib/ids.ts";
import { runScheduled } from "../src/scheduled.ts";
import {
	createUser,
	type EnvOverrides,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";
import { fakePushFetch, newVapidKeys } from "./push-fakes.ts";

beforeEach(resetDb);

// São Paulo (UTC-3).
const at = (date: string, time: string) =>
	new Date(Date.parse(`${date}T${time}:00-03:00`)).toISOString();
const TODAY = "2026-10-15";
const V3 = { [SCHEDULE_VERSION_HEADER]: "3" };

let api: TestApi;
let owner: TestUser;
let overrides: EnvOverrides;

async function setup(now = at(TODAY, "12:00")) {
	const vapid = await newVapidKeys();
	overrides = {
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: vapid.subject,
		ALLOW_SIGNUP: "true",
	};
	api = makeApi(now, overrides);
	owner = await createUser(api, "owner@example.com");
}

const auth = (user = owner, extra: Record<string, string> = {}) => ({
	...user.auth(),
	...extra,
});

async function post(body: Record<string, unknown>, user = owner) {
	return api.request(
		"/v1/habits",
		json(body, { method: "POST", headers: auth(user) })
	);
}

async function createTask(name: string, due: string, start = TODAY) {
	const response = await post({
		name,
		schedule: { type: "deadline", due_date: due },
		start_date: start,
	});
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: Habit }).habit;
}

async function createDaily(name: string, start = "2026-10-01") {
	const response = await post({
		name,
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: start,
	});
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: Habit }).habit;
}

const mark = (habitId: string, date: string, completed = true) =>
	api.request(
		`/v1/habits/${habitId}/completions/${date}`,
		json({ completed }, { method: "PUT", headers: auth() })
	);

async function day(date: string, user = owner): Promise<DayResponse> {
	const response = await api.request(`/v1/day?date=${date}`, {
		headers: auth(user),
	});
	expect(response.status).toBe(200);
	return (await response.json()) as DayResponse;
}

describe("creation", () => {
	beforeEach(() => setup());

	it("accepts a due date from today up to two years ahead", async () => {
		expect(
			(
				await post({
					name: "Hoje",
					schedule: { type: "deadline", due_date: TODAY },
					start_date: TODAY,
				})
			).status
		).toBe(201);
		expect(
			(
				await post({
					name: "Longe",
					schedule: { type: "deadline", due_date: "2028-10-14" },
					start_date: TODAY,
				})
			).status
		).toBe(201);
	});

	it("refuses a past due date, one too far, one before the start, and a past start", async () => {
		const cases: [Record<string, unknown>, string][] = [
			[
				{
					schedule: { type: "deadline", due_date: "2026-10-14" },
					start_date: TODAY,
				},
				"date_out_of_range",
			],
			[
				{
					schedule: { type: "deadline", due_date: "2028-10-15" },
					start_date: TODAY,
				},
				"date_out_of_range",
			],
			[
				{
					schedule: { type: "deadline", due_date: TODAY },
					start_date: "2026-10-16",
				},
				"validation_error",
			],
			[
				{
					schedule: { type: "deadline", due_date: "2026-10-20" },
					start_date: "2026-10-14",
				},
				"date_out_of_range",
			],
			[
				{
					schedule: { type: "deadline", due_date: "20/10/2026" },
					start_date: TODAY,
				},
				"validation_error",
			],
		];
		for (const [body, code] of cases) {
			const response = await post({ name: "X", ...body });
			expect(response.status).toBe(422);
			expect(
				((await response.json()) as { error: { code: string } }).error.code
			).toBe(code);
		}
	});

	it("keeps another user's task out of sight", async () => {
		const task = await createTask("Relatório", "2026-10-20");
		const bob = await createUser(api, "bob@example.com");
		expect((await day(TODAY, bob)).deadline).toEqual([]);
		const marked = await api.request(
			`/v1/habits/${task.id}/completions/${TODAY}`,
			json({ completed: true }, { method: "PUT", headers: auth(bob) })
		);
		expect(marked.status).toBe(404);
	});
});

describe("GET /v1/day", () => {
	beforeEach(() => setup());

	it("lists open tasks on today only, by due date, with the progress rule", async () => {
		const ler = await createDaily("Ler");
		const later = await createTask("Relatório", "2026-10-25");
		const soon = await createTask("Consulta", "2026-10-17");
		await mark(ler.id, TODAY);

		const today = await day(TODAY);
		expect(
			today.deadline?.map((item) => [item.habit.name, item.due_date])
		).toEqual([
			["Consulta", "2026-10-17"],
			["Relatório", "2026-10-25"],
		]);
		expect(today.possible_habits.map((h) => h.name)).toEqual(["Ler"]);

		await mark(later.id, TODAY);
		const after = await day(TODAY);
		expect(after.possible_habits.map((h) => h.name).sort()).toEqual([
			"Ler",
			"Relatório",
		]);
		expect(after.completed_habit_ids.sort()).toEqual([ler.id, later.id].sort());
		expect(
			after.deadline?.find((i) => i.habit.id === later.id)?.completed_today
		).toBe(true);

		expect((await day("2026-10-14")).deadline).toBeUndefined();
		expect((await day("2026-10-16")).deadline).toBeUndefined();
		void soon;
	});

	it("reads a first completion older than the 17-day window", async () => {
		const task = await createTask("Relatório", "2026-11-20");
		await mark(task.id, TODAY);
		api.setNow(at("2026-11-20", "12:00"));
		// Done 36 days before: no failure on the due date, not listed today.
		const due = await day("2026-11-20");
		expect(due.possible_habits).toEqual([]);
		expect(due.deadline).toEqual([]);
		expect(due.overdue).toEqual([]);
	});

	it("keeps the failure on a missed due date, overdue after it, and says 'já concluída'", async () => {
		const task = await createTask("Relatório", "2026-10-16");
		api.setNow(at("2026-10-18", "12:00"));
		const overdue = await day("2026-10-18");
		expect(overdue.overdue?.map((item) => item.since)).toEqual(["2026-10-16"]);
		await mark(task.id, "2026-10-18");

		const missed = await day("2026-10-16");
		expect(missed.possible_habits.map((h) => h.id)).toEqual([task.id]);
		expect(missed.completed_habit_ids).toEqual([]);
		expect(missed.deadline_done).toEqual([
			{ habit_id: task.id, date: "2026-10-18" },
		]);
	});
});

describe("GET /v1/summary across the year", () => {
	it("does not count a December completion again on a January due date", async () => {
		await setup(at("2026-12-20", "12:00"));
		const task = await createTask("Relatório", "2027-01-10", "2026-12-20");
		await mark(task.id, "2026-12-20");
		api.setNow(at("2027-01-31", "12:00"));
		const response = await api.request("/v1/summary?year=2027", {
			headers: auth(),
		});
		const { days } = (await response.json()) as SummaryResponse;
		expect(days).toEqual([]);
	});
});

describe("locked due date", () => {
	beforeEach(() => setup());

	it("moves before it passes, and is refused after, over REST and sync", async () => {
		const task = await createTask("Relatório", "2026-10-20");
		const patch = (due: string) =>
			api.request(
				`/v1/habits/${task.id}`,
				json(
					{ schedule: { type: "deadline", due_date: due } },
					{ method: "PATCH", headers: auth() }
				)
			);
		expect((await patch("2026-10-30")).status).toBe(200);

		api.setNow(at("2026-11-02", "12:00"));
		const refused = await patch("2026-11-10");
		expect(refused.status).toBe(422);
		expect(await refused.json()).toMatchObject({
			error: {
				code: "validation_error",
				details: { reason: "deadline_passed" },
			},
		});
		expect((await patch("2026-10-30")).status).toBe(200); // unchanged: fine
		const renamed = await api.request(
			`/v1/habits/${task.id}`,
			json({ name: "Relatório final" }, { method: "PATCH", headers: auth() })
		);
		expect(renamed.status).toBe(200);

		const push = await api.request(
			"/v1/sync/push",
			json(
				{
					protocol: 1,
					mutations: [
						{
							mutation_id: uuidV7(Date.now()),
							created_at: 1,
							type: "habit.update",
							habit_id: task.id,
							changes: {
								schedule: { type: "deadline", due_date: "2026-11-10" },
							},
						},
					],
				},
				{ method: "POST", headers: auth() }
			)
		);
		const { results } = (await push.json()) as SyncPushResponse;
		expect(results[0]).toMatchObject({
			status: "rejected",
			error: { code: "validation_error" },
		});
	});
});

describe("older clients (schedule version 2)", () => {
	beforeEach(() => setup());

	it("never see deadline tasks or their completions; version 3 does", async () => {
		const ler = await createDaily("Ler");
		const task = await createTask("Relatório", "2026-10-20");
		await mark(task.id, TODAY);
		await mark(ler.id, TODAY);

		const list = async (headers: Record<string, string>) => {
			const response = await api.request("/v1/habits", {
				headers: auth(owner, headers),
			});
			return (await response.json()) as HabitListResponse;
		};
		const old = await list({ [SCHEDULE_VERSION_HEADER]: "2" });
		expect(old.habits.map((h) => h.name)).toEqual(["Ler"]);
		expect(old.deadline_completions).toBeUndefined();
		const fresh = await list(V3);
		expect(fresh.habits.map((h) => h.name)).toEqual(["Ler", "Relatório"]);
		expect(fresh.deadline_completions).toEqual([
			{ habit_id: task.id, date: TODAY },
		]);

		const pull = async (headers: Record<string, string>) => {
			const response = await api.request("/v1/sync/pull", {
				headers: auth(owner, headers),
			});
			return (await response.json()) as SyncPullResponse;
		};
		const oldPull = await pull({ [SCHEDULE_VERSION_HEADER]: "2" });
		expect(oldPull.changes.habits.map((h) => h.id)).toEqual([ler.id]);
		expect(oldPull.changes.completions.map((c) => c.habit_id)).toEqual([
			ler.id,
		]);
		const newPull = await pull(V3);
		expect(newPull.changes.habits.map((h) => h.id).sort()).toEqual(
			[ler.id, task.id].sort()
		);
		expect(newPull.changes.completions).toHaveLength(2);
	});
});

describe("notifications", () => {
	const EXPO_TOKEN = "ExponentPushToken[deadline-device]";
	const run = (iso: string, fake: ReturnType<typeof fakePushFetch>) =>
		runScheduled({
			env: { ...env, ...overrides } as Env,
			now: Date.parse(iso),
			fetch: fake.fetch,
		});
	const bodies = (fake: ReturnType<typeof fakePushFetch>, kind: string) =>
		fake
			.expoSends()
			.flat()
			.filter((m) => (m.data as { kind?: string }).kind === kind)
			.map((m) => m.body);

	async function withDevice(settings: Record<string, unknown> = {}) {
		await setup(at("2026-10-14", "12:00"));
		const device = await api.request(
			"/v1/push/subscriptions",
			json(
				{ kind: "expo", token: EXPO_TOKEN },
				{ method: "POST", headers: auth() }
			)
		);
		expect(device.status).toBe(200);
		const saved = await api.request(
			"/v1/settings",
			json(
				{ reminder_time: "20:00", ...settings },
				{ method: "PATCH", headers: auth() }
			)
		);
		expect(saved.status).toBe(200);
	}

	it("digest names tasks due today and tomorrow once, even under two runs", async () => {
		await withDevice();
		await createTask("Pagar boleto", TODAY, "2026-10-14");
		await createTask("Consulta", "2026-10-16", "2026-10-14");
		await createTask("Viagem", "2026-12-01", "2026-10-14");
		const fake = fakePushFetch();
		await Promise.all([
			run(at(TODAY, "09:00"), fake),
			run(at(TODAY, "09:00"), fake),
		]);
		expect(bodies(fake, "digest")).toEqual([
			"1 hábito hoje. Vence hoje: Pagar boleto. Vence amanhã: Consulta.",
		]);
	});

	it("hides the names when titles are off", async () => {
		await withDevice({ show_titles_in_notifications: false });
		await createTask("Pagar boleto", TODAY, "2026-10-14");
		await createTask("Consulta", "2026-10-16", "2026-10-14");
		const fake = fakePushFetch();
		await run(at(TODAY, "09:00"), fake);
		expect(bodies(fake, "digest")).toEqual([
			"Você tem compromissos hoje e amanhã.",
		]);
	});

	it("the reminder counts tasks due today and overdue ones, not later ones", async () => {
		await withDevice();
		await createTask("Pagar boleto", TODAY, "2026-10-14");
		await createTask("Viagem", "2026-12-01", "2026-10-14");
		const missed = await createTask("Relatório", "2026-10-14", "2026-10-14");
		void missed;
		const fake = fakePushFetch();
		await run(at(TODAY, "20:15"), fake);
		expect(bodies(fake, "reminder")).toEqual([
			"Você tem 2 hábitos pendentes hoje.",
		]);
	});
});
