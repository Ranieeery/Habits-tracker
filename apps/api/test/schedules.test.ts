// Schedule types added in 2.2.0 (interval, monthly_days, once, yearly): REST
// validation, day views, and the protection for clients that only understand
// weekday schedules (no X-Habits-Schedule-Version header: the 2.1.0 apps).
import {
	type DayResponse,
	type Habit,
	SCHEDULE_VERSION,
	SCHEDULE_VERSION_HEADER,
	type SyncPullResponse,
} from "@habits/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, json, makeApi, resetDb } from "./helpers.ts";

beforeEach(resetDb);

// 2026-10-09 12:00 in São Paulo (a Friday).
const NOW = "2026-10-09T15:00:00Z";
const TODAY = "2026-10-09";
const NEW_CLIENT = { [SCHEDULE_VERSION_HEADER]: String(SCHEDULE_VERSION) };

async function setup() {
	const api = makeApi(NOW, { ALLOW_SIGNUP: "true" });
	const owner = await createUser(api, "owner@example.com");
	const headers = (old = false) =>
		old ? owner.auth() : { ...owner.auth(), ...NEW_CLIENT };
	const post = (body: unknown) =>
		api.request(
			"/v1/habits",
			json(body, { method: "POST", headers: headers() })
		);
	const patch = (id: string, body: unknown) =>
		api.request(
			`/v1/habits/${id}`,
			json(body, { method: "PATCH", headers: headers() })
		);
	const list = async (old = false) => {
		const response = await api.request("/v1/habits", { headers: headers(old) });
		return ((await response.json()) as { habits: Habit[] }).habits;
	};
	const pull = async (old: boolean, query = "") => {
		const response = await api.request(`/v1/sync/pull${query}`, {
			headers: headers(old),
		});
		expect(response.status).toBe(200);
		return (await response.json()) as SyncPullResponse;
	};
	const day = async (date: string) => {
		const response = await api.request(`/v1/day?date=${date}`, {
			headers: headers(),
		});
		return (await response.json()) as DayResponse;
	};
	return { api, owner, post, patch, list, pull, day };
}

const habitOf = async (response: Response) =>
	((await response.json()) as { habit: Habit }).habit;

const EXAMPLES = [
	{
		name: "Consulta no dermatologista",
		schedule: { type: "once", date: "2026-11-20" },
		start_date: "2026-11-20",
	},
	{
		name: "Trocar filtro",
		schedule: { type: "interval", every: 8, anchor_date: TODAY },
		start_date: TODAY,
	},
	{
		name: "Pagar condomínio",
		schedule: { type: "monthly_days", days: [20] },
		start_date: TODAY,
	},
	{
		name: "Aniversário",
		schedule: { type: "yearly", month: 2, day: 29 },
		start_date: TODAY,
	},
];

describe("creating habits with the new schedules", () => {
	it.each(EXAMPLES)("creates $name", async (body) => {
		const { post } = await setup();
		const response = await post(body);
		expect(response.status).toBe(201);
		expect(await habitOf(response)).toMatchObject(body);
	});

	it("refuses a single date in the past with a clear error", async () => {
		const { post } = await setup();
		const response = await post({
			name: "Consulta",
			schedule: { type: "once", date: "2026-10-08" },
			start_date: "2026-10-08",
		});
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "date_out_of_range", details: { earliest: TODAY } },
		});
	});

	it("refuses a start in the past for the new schedules, not for weekdays", async () => {
		const { post } = await setup();
		const every8 = {
			name: "Filtro",
			schedule: { type: "interval", every: 8, anchor_date: "2026-10-08" },
			start_date: "2026-10-08",
		};
		expect((await post(every8)).status).toBe(422);
		const weekdays = {
			name: "Ler",
			schedule: { type: "weekdays", days: [1] },
			start_date: "2026-10-05",
		};
		expect((await post(weekdays)).status).toBe(201);
	});

	it("refuses a single date before the start", async () => {
		const { post } = await setup();
		const response = await post({
			name: "Consulta",
			schedule: { type: "once", date: "2026-10-20" },
			start_date: "2026-10-25",
		});
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});

	it.each([
		{ type: "interval", every: 0, anchor_date: TODAY },
		{ type: "interval", every: 400, anchor_date: TODAY },
		{ type: "monthly_days", days: [32] },
		{ type: "yearly", month: 4, day: 31 },
		{ type: "lunar" },
	])("validates %j", async (schedule) => {
		const { post } = await setup();
		const response = await post({ name: "X", schedule, start_date: TODAY });
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});

	it("rescheduling to a past single date is refused", async () => {
		const { post, patch } = await setup();
		const habit = await habitOf(
			await post({
				name: "Ler",
				schedule: { type: "weekdays", days: [1] },
				start_date: "2026-10-05",
			})
		);
		const past = await patch(habit.id, {
			schedule: { type: "once", date: "2026-10-01" },
		});
		expect(past.status).toBe(422);
		const future = await patch(habit.id, {
			schedule: { type: "once", date: "2026-10-30" },
		});
		expect(future.status).toBe(200);
		expect((await habitOf(future)).schedule).toEqual({
			type: "once",
			date: "2026-10-30",
		});
	});
});

describe("day views with mixed schedule types", () => {
	it("lists each habit on the days it happens", async () => {
		const { post, day } = await setup();
		for (const body of EXAMPLES) await post(body);
		await post({
			name: "Ler",
			schedule: { type: "weekdays", days: [5] },
			start_date: TODAY,
		});

		const names = async (date: string) =>
			(await day(date)).possible_habits.map((h) => h.name).sort();
		expect(await names(TODAY)).toEqual(["Ler", "Trocar filtro"]);
		expect(await names("2026-10-17")).toEqual(["Trocar filtro"]);
		expect(await names("2026-10-20")).toEqual(["Pagar condomínio"]);
		expect(await names("2026-11-20")).toEqual([
			"Consulta no dermatologista",
			"Ler",
			"Pagar condomínio",
		]);
	});
});

describe("clients that only understand weekday schedules", () => {
	async function mixed() {
		const ctx = await setup();
		const weekly = await habitOf(
			await ctx.post({
				name: "Ler",
				schedule: { type: "weekdays", days: [5] },
				start_date: TODAY,
			})
		);
		const every2 = await habitOf(
			await ctx.post({
				name: "Filtro",
				schedule: { type: "interval", every: 2, anchor_date: TODAY },
				start_date: TODAY,
			})
		);
		for (const habit of [weekly, every2]) {
			const response = await ctx.api.request(
				`/v1/habits/${habit.id}/completions/${TODAY}`,
				json(
					{ completed: true },
					{ method: "PUT", headers: { ...ctx.owner.auth(), ...NEW_CLIENT } }
				)
			);
			expect(response.status).toBe(200);
		}
		return { ...ctx, weekly, every2 };
	}

	it("GET /v1/habits leaves out the newer types without the header", async () => {
		const { list, weekly } = await mixed();
		expect((await list(true)).map((h) => h.id)).toEqual([weekly.id]);
		expect(await list(false)).toHaveLength(2);
	});

	it("GET /v1/sync/pull leaves out those habits and their completions, and the cursor still moves", async () => {
		const { pull, weekly } = await mixed();

		const old = await pull(true);
		expect(old.changes.habits.map((h) => h.id)).toEqual([weekly.id]);
		expect(old.changes.completions.map((c) => c.habit_id)).toEqual([weekly.id]);
		expect(old.has_more).toBe(false);
		// Nothing left behind the cursor for the old client.
		const next = await pull(true, `?cursor=${old.cursor}`);
		expect(next.changes).toEqual({ habits: [], completions: [] });

		const current = await pull(false);
		expect(current.changes.habits).toHaveLength(2);
		expect(current.changes.completions).toHaveLength(2);
		expect(current.cursor).toBe(old.cursor);
	});

	it("pages for old clients advance past hidden rows", async () => {
		const { pull, weekly } = await mixed();
		const seen: string[] = [];
		let cursor = "";
		for (let page = 0; page < 10; page++) {
			const response = await pull(true, `?limit=1${cursor}`);
			seen.push(...response.changes.habits.map((h) => h.id));
			cursor = `&cursor=${response.cursor}`;
			if (!response.has_more) break;
		}
		expect(seen).toEqual([weekly.id]);
	});

	it("never shows another user's habits either way", async () => {
		const { api, post } = await setup();
		await post(EXAMPLES[0]);
		const other = await createUser(api, "other@example.com");
		const response = await api.request("/v1/habits", {
			headers: { ...other.auth(), ...NEW_CLIENT },
		});
		expect(((await response.json()) as { habits: Habit[] }).habits).toEqual([]);
	});
});
