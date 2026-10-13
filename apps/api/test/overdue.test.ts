// Overdue fixed-day habits (2.8.0): the additive `overdue` field of today's
// `GET /v1/day`, and overdue habits in the morning digest and the reminder.
import type { DayResponse } from "@habits/contracts";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
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

// Thursday 2026-11-19, São Paulo (UTC-3). The habits were created on the 10th.
const TODAY = "2026-11-19";
const at = (date: string, time: string) =>
	new Date(Date.parse(`${date}T${time}:00-03:00`)).toISOString();
const EXPO_TOKEN = "ExponentPushToken[pixel-9-token]";

let overrides: EnvOverrides;

async function createHabit(api: TestApi, user: TestUser, body: unknown) {
	const response = await api.request(
		"/v1/habits",
		json(body, { method: "POST", headers: user.auth() })
	);
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: { id: string } }).habit.id;
}

async function setCompletion(
	api: TestApi,
	user: TestUser,
	habitId: string,
	date: string,
	completed: boolean
) {
	const response = await api.request(
		`/v1/habits/${habitId}/completions/${date}`,
		json({ completed }, { method: "PUT", headers: user.auth() })
	);
	expect(response.status).toBe(200);
}

async function getDay(api: TestApi, user: TestUser, date: string) {
	const response = await api.request(`/v1/day?date=${date}`, {
		headers: user.auth(),
	});
	expect(response.status).toBe(200);
	return (await response.json()) as DayResponse;
}

async function patchSettings(api: TestApi, user: TestUser, body: unknown) {
	const response = await api.request(
		"/v1/settings",
		json(body, { method: "PATCH", headers: user.auth() })
	);
	expect(response.status).toBe(200);
}

async function setup(email = "owner@example.com") {
	const vapid = await newVapidKeys();
	overrides = {
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: vapid.subject,
		ALLOW_SIGNUP: "true",
	};
	const api = makeApi(at("2026-11-10", "12:00"), overrides);
	const user = await createUser(api, email);
	const device = await api.request(
		"/v1/push/subscriptions",
		json(
			{ kind: "expo", token: EXPO_TOKEN },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(device.status).toBe(200);
	const condo = await createHabit(api, user, {
		name: "Pagar condomínio",
		schedule: { type: "monthly_days", days: [15] },
		start_date: "2026-11-10",
	});
	const appointment = await createHabit(api, user, {
		name: "Consulta",
		schedule: { type: "once", date: "2026-11-12" },
		start_date: "2026-11-12",
	});
	const read = await createHabit(api, user, {
		name: "Ler",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-11-10",
	});
	api.setNow(at(TODAY, "09:00"));
	return { api, user, condo, appointment, read, fake: fakePushFetch() };
}

function runCron(iso: string, fake: ReturnType<typeof fakePushFetch>) {
	return runScheduled({
		env: { ...env, ...overrides } as Env,
		now: Date.parse(iso),
		fetch: fake.fetch,
	});
}

const sentOf = (fake: ReturnType<typeof fakePushFetch>, kind: string) =>
	fake
		.expoSends()
		.flat()
		.filter((m) => (m.data as { kind?: string }).kind === kind);

describe("GET /v1/day overdue", () => {
	it("lists the overdue habits on today only, in the user's order", async () => {
		const { api, user, condo, appointment, read } = await setup();

		const today = await getDay(api, user, TODAY);
		expect(today.possible_habits.map((h) => h.id)).toEqual([read]);
		expect(
			today.overdue?.map((item) => [
				item.habit.id,
				item.since,
				item.completed_today,
			])
		).toEqual([
			[condo, "2026-11-15", false],
			[appointment, "2026-11-12", false],
		]);

		const yesterday = await getDay(api, user, "2026-11-18");
		expect(yesterday).not.toHaveProperty("overdue");
		const tomorrow = await getDay(api, user, "2026-11-20");
		expect(tomorrow).not.toHaveProperty("overdue");
	});

	it("keeps a habit marked today (checked) and brings it back when unmarked", async () => {
		const { api, user, condo } = await setup();
		await setCompletion(api, user, condo, TODAY, true);

		const marked = await getDay(api, user, TODAY);
		expect(marked.completed_habit_ids).toContain(condo);
		// Counted as possible and done today; listed once as overdue.
		expect(marked.possible_habits.map((h) => h.id)).toContain(condo);
		expect(marked.overdue?.find((i) => i.habit.id === condo)).toMatchObject({
			since: "2026-11-15",
			completed_today: true,
		});
		// The missed day keeps its failure.
		const missed = await getDay(api, user, "2026-11-15");
		expect(missed.completed_habit_ids).not.toContain(condo);

		await setCompletion(api, user, condo, TODAY, false);
		const unmarked = await getDay(api, user, TODAY);
		expect(unmarked.overdue?.find((i) => i.habit.id === condo)).toMatchObject({
			completed_today: false,
		});
	});

	it("drops a habit completed on a past day inside the window", async () => {
		const { api, user, condo } = await setup();
		await setCompletion(api, user, condo, "2026-11-17", true);
		const today = await getDay(api, user, TODAY);
		expect(today.overdue?.map((item) => item.habit.id)).not.toContain(condo);
	});

	it("leaves the overdue habit out of the summary while pending", async () => {
		const { api, user } = await setup();
		const response = await api.request("/v1/summary?year=2026", {
			headers: user.auth(),
		});
		const { days } = (await response.json()) as {
			days: { date: string; possible: number; completed: number }[];
		};
		const byDate = new Map(days.map((day) => [day.date, day]));
		expect(byDate.get("2026-11-15")).toMatchObject({ possible: 2 });
		expect(byDate.get(TODAY)).toMatchObject({ possible: 1, completed: 0 });
	});

	it("never shows another user's habits", async () => {
		const { api } = await setup();
		const other = await createUser(api, "other@example.com");
		const day = await getDay(api, other, TODAY);
		expect(day.overdue).toEqual([]);
		expect(day.possible_habits).toEqual([]);
	});
});

describe("overdue habits in notifications", () => {
	it("counts and names them in the digest", async () => {
		const { fake } = await setup();
		const report = await runCron(at(TODAY, "09:00"), fake);
		expect(report).toMatchObject({ digests: 1 });
		expect(sentOf(fake, "digest")).toEqual([
			expect.objectContaining({
				body: "1 hábito hoje. 2 atrasados: Pagar condomínio e Consulta.",
			}),
		]);
	});

	it("only counts them when titles are hidden", async () => {
		const { api, user, fake } = await setup();
		await patchSettings(api, user, { show_titles_in_notifications: false });
		await runCron(at(TODAY, "09:00"), fake);
		const [digest] = sentOf(fake, "digest");
		expect(digest?.body).toBe(
			"Você tem compromissos hoje e 2 hábitos atrasados."
		);
		expect(JSON.stringify(fake.expoSends())).not.toMatch(/condomínio|Consulta/);
	});

	it("sends the digest for overdue habits alone", async () => {
		const { api, user, read, fake } = await setup();
		await setCompletion(api, user, read, TODAY, true);
		await runCron(at(TODAY, "09:00"), fake);
		expect(sentOf(fake, "digest")[0]?.body).toBe(
			// The total counts today's habits, done ones included (as before).
			"1 hábito hoje. 2 atrasados: Pagar condomínio e Consulta."
		);
	});

	it("counts pending overdue habits in the reminder, once a day", async () => {
		const { api, user, condo, fake } = await setup();
		await patchSettings(api, user, {
			morning_digest_enabled: false,
			reminder_time: "20:00",
		});
		await setCompletion(api, user, condo, TODAY, true);

		const reports = await Promise.all([
			runCron(at(TODAY, "20:00"), fake),
			runCron(at(TODAY, "20:00"), fake),
		]);
		expect(reports.map((r) => r.reminders).sort()).toEqual([0, 1]);
		await runCron(at(TODAY, "20:15"), fake);
		const reminders = sentOf(fake, "reminder");
		expect(reminders).toHaveLength(1);
		// Ler (today) + Consulta (overdue); the condo was marked today.
		expect(reminders[0]?.body).toBe("Você tem 2 hábitos pendentes hoje.");
	});

	it("sends no reminder when only done overdue habits are left", async () => {
		const { api, user, condo, appointment, read, fake } = await setup();
		await patchSettings(api, user, {
			morning_digest_enabled: false,
			reminder_time: "20:00",
		});
		for (const id of [condo, appointment, read]) {
			await setCompletion(api, user, id, TODAY, true);
		}
		const report = await runCron(at(TODAY, "20:00"), fake);
		expect(report.reminders).toBe(0);
	});
});
