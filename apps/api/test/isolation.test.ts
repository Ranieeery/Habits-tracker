// A user never reads or changes another user's data, on any route.
import type {
	Completion,
	DayResponse,
	Habit,
	SummaryResponse,
} from "@habits/contracts";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { completions, habits, pushSubscriptions } from "../src/db/schema.ts";
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
const EVERY_DAY = { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] };

let api: TestApi;
let alice: TestUser;
let bob: TestUser;
let aliceHabit: Habit;
let aliceCompletion: Completion;
let aliceDevice: string;

beforeEach(async () => {
	await resetDb();
	api = makeApi(`${TODAY}T15:00:00Z`, { ALLOW_SIGNUP: "true" });
	alice = await createUser(api, "alice@example.com");
	bob = await createUser(api, "bob@example.com");

	const habit = await api.request(
		"/v1/habits",
		json(
			{ name: "Correr", schedule: EVERY_DAY, start_date: TODAY },
			{ method: "POST", headers: alice.auth() }
		)
	);
	aliceHabit = ((await habit.json()) as { habit: Habit }).habit;
	const completion = await api.request(
		`/v1/habits/${aliceHabit.id}/completions/${TODAY}`,
		json({ completed: true }, { method: "PUT", headers: alice.auth() })
	);
	aliceCompletion = ((await completion.json()) as { completion: Completion })
		.completion;
	const device = await api.request(
		"/v1/push/subscriptions",
		json(
			{ kind: "expo", token: "ExponentPushToken[alice-device]" },
			{ method: "POST", headers: alice.auth() }
		)
	);
	aliceDevice = ((await device.json()) as { subscription: { id: string } })
		.subscription.id;
});

/** Alice's rows are exactly as she left them. */
async function expectAliceUntouched() {
	expect(
		await db.select().from(habits).where(eq(habits.user_id, alice.id))
	).toMatchObject([{ id: aliceHabit.id, name: "Correr", archived_at: null }]);
	expect(
		await db.select().from(completions).where(eq(completions.user_id, alice.id))
	).toMatchObject([{ id: aliceCompletion.id, deleted_at: null }]);
	expect(
		await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.user_id, alice.id))
	).toMatchObject([{ id: aliceDevice }]);
}

const asBob = (path: string, init: RequestInit = {}) =>
	api.request(path, {
		...init,
		headers: { ...bob.auth(), ...init.headers },
	});

describe.each(["bearer", "cookie"] as const)("as another user (%s)", (kind) => {
	const as = (path: string, init: RequestInit = {}) =>
		api.request(path, {
			...init,
			headers: { ...bob.auth(kind), ...init.headers },
		});

	it("does not list the habits", async () => {
		const response = await as("/v1/habits");
		expect(await response.json()).toEqual({ habits: [] });
	});

	it("cannot rename, reschedule or archive a habit", async () => {
		for (const body of [
			{ name: "Hacked" },
			{ schedule: { type: "weekdays", days: [1] } },
			{ archived: true },
		]) {
			const response = await as(
				`/v1/habits/${aliceHabit.id}`,
				json(body, { method: "PATCH" })
			);
			expect(response.status).toBe(404);
		}
		await expectAliceUntouched();
	});

	it("cannot mark or unmark a completion", async () => {
		for (const completed of [true, false]) {
			const response = await as(
				`/v1/habits/${aliceHabit.id}/completions/${TODAY}`,
				json({ completed }, { method: "PUT" })
			);
			expect(response.status).toBe(404);
		}
		await expectAliceUntouched();
	});

	it("does not see the day or the summary", async () => {
		const day = (await (
			await as(`/v1/day?date=${TODAY}`)
		).json()) as DayResponse;
		expect(day).toEqual({
			date: TODAY,
			possible_habits: [],
			completed_habit_ids: [],
		});
		const summary = (await (
			await as("/v1/summary?year=2026")
		).json()) as SummaryResponse;
		expect(summary.days).toEqual([]);
	});

	it("does not see or change the settings", async () => {
		await api.request(
			"/v1/settings",
			json(
				{ reminder_time: "07:00" },
				{ method: "PATCH", headers: alice.auth() }
			)
		);
		await as(
			"/v1/settings",
			json({ timezone: "Asia/Tokyo" }, { method: "PATCH" })
		);

		const mine = await (await as("/v1/settings")).json();
		expect(mine).toMatchObject({
			settings: { timezone: "Asia/Tokyo", reminder_time: null },
		});
		const hers = await (
			await api.request("/v1/settings", { headers: alice.auth() })
		).json();
		expect(hers).toMatchObject({
			settings: { timezone: "America/Sao_Paulo", reminder_time: "07:00" },
		});
	});

	it("cannot delete a push subscription", async () => {
		const response = await as(`/v1/push/subscriptions/${aliceDevice}`, {
			method: "DELETE",
		});
		expect(response.status).toBe(404);
		await expectAliceUntouched();
	});
});

describe("ids owned by another user", () => {
	it("cannot be reused to create a habit", async () => {
		const response = await asBob(
			"/v1/habits",
			json(
				{
					id: aliceHabit.id,
					name: "Mine",
					schedule: EVERY_DAY,
					start_date: TODAY,
				},
				{ method: "POST" }
			)
		);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "conflict" },
		});
		await expectAliceUntouched();
	});

	it("cannot be reused for a completion", async () => {
		const habit = await asBob(
			"/v1/habits",
			json(
				{ name: "Mine", schedule: EVERY_DAY, start_date: TODAY },
				{ method: "POST" }
			)
		);
		const { habit: bobHabit } = (await habit.json()) as { habit: Habit };

		const response = await asBob(
			`/v1/habits/${bobHabit.id}/completions/${TODAY}`,
			json({ completed: true, id: aliceCompletion.id }, { method: "PUT" })
		);
		expect(response.status).toBe(409);
		await expectAliceUntouched();
	});

	it("cannot be reused for a push subscription", async () => {
		const response = await asBob(
			"/v1/push/subscriptions",
			json(
				{
					id: aliceDevice,
					kind: "expo",
					token: "ExponentPushToken[bob-device]",
				},
				{ method: "POST" }
			)
		);
		expect(response.status).toBe(409);
		await expectAliceUntouched();
	});
});
