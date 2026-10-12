// Morning digest (2.2.0): fixed 09:00 in the user's zone, independent of the
// reminder, at most once a day, titles only when the user allows them.
import { SCHEDULE_VERSION_HEADER } from "@habits/contracts";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { reminderState } from "../src/db/schema.ts";
import { runScheduled } from "../src/scheduled.ts";
import {
	createUser,
	db,
	type EnvOverrides,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";
import { fakePushFetch, newVapidKeys, newWebPushKeys } from "./push-fakes.ts";

beforeEach(resetDb);

// Thursday 2026-11-19, São Paulo (UTC-3).
const TODAY = "2026-11-19";
const at = (date: string, time: string) =>
	new Date(Date.parse(`${date}T${time}:00-03:00`)).toISOString();
const AT_0900 = at(TODAY, "09:00");
const EXPO_TOKEN = "ExponentPushToken[pixel-9-token]";

let overrides: EnvOverrides;

function runCron(iso: string, fake: ReturnType<typeof fakePushFetch>) {
	return runScheduled({
		env: { ...env, ...overrides } as Env,
		now: Date.parse(iso),
		fetch: fake.fetch,
	});
}

async function createHabit(api: TestApi, user: TestUser, body: unknown) {
	const response = await api.request(
		"/v1/habits",
		json(body, { method: "POST", headers: user.auth() })
	);
	expect(response.status).toBe(201);
	return ((await response.json()) as { habit: { id: string } }).habit.id;
}

async function patchSettings(api: TestApi, user: TestUser, body: unknown) {
	const response = await api.request(
		"/v1/settings",
		json(body, { method: "PATCH", headers: user.auth() })
	);
	expect(response.status).toBe(200);
}

async function setup() {
	const vapid = await newVapidKeys();
	overrides = {
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: vapid.subject,
		ALLOW_SIGNUP: "true",
	};
	// Habits are created the day before, so single dates "tomorrow" are valid.
	const api = makeApi(at("2026-11-18", "12:00"), overrides);
	const user = await createUser(api, "owner@example.com");
	const device = await api.request(
		"/v1/push/subscriptions",
		json(
			{ kind: "expo", token: EXPO_TOKEN },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(device.status).toBe(200);
	const filter = await createHabit(api, user, {
		name: "Trocar filtro",
		schedule: { type: "interval", every: 8, anchor_date: TODAY },
		start_date: TODAY,
	});
	await createHabit(api, user, {
		name: "Consulta dermatologista",
		schedule: { type: "once", date: "2026-11-20" },
		start_date: "2026-11-20",
	});
	await createHabit(api, user, {
		name: "Ler",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-11-18",
	});
	api.setNow(AT_0900);
	return { api, user, filter, fake: fakePushFetch() };
}

const digestsOf = (fake: ReturnType<typeof fakePushFetch>) =>
	fake
		.expoSends()
		.flat()
		.filter((m) => (m.data as { kind?: string }).kind === "digest");

describe("morning digest cron", () => {
	it("sends today's highlights, the total and tomorrow's single date at 09:00", async () => {
		const { fake } = await setup();

		const early = await runCron(at(TODAY, "08:45"), fake);
		expect(early.digests).toBe(0);

		const report = await runCron(AT_0900, fake);
		expect(report).toMatchObject({ digests: 1, reminders: 0, sent: 1 });
		expect(digestsOf(fake)).toEqual([
			expect.objectContaining({
				to: EXPO_TOKEN,
				title: "Resumo do dia",
				body: "Hoje: Trocar filtro. 2 hábitos hoje. Amanhã: Consulta dermatologista.",
				data: { url: "/day/hoje", kind: "digest" },
			}),
		]);
	});

	it("sends at most once a day, also when two runs overlap", async () => {
		const { user, fake } = await setup();
		const reports = await Promise.all([
			runCron(AT_0900, fake),
			runCron(AT_0900, fake),
		]);
		expect(reports.map((r) => r.digests).sort()).toEqual([0, 1]);
		await runCron(at(TODAY, "09:15"), fake);
		expect(digestsOf(fake)).toHaveLength(1);

		const [state] = await db
			.select()
			.from(reminderState)
			.where(eq(reminderState.user_id, user.id));
		expect(state?.last_digest_date).toBe(TODAY);
		expect(state?.last_reminder_date ?? null).toBeNull();
	});

	it("catches up within the window when the cron is late, not after", async () => {
		const { fake } = await setup();
		await runCron(at(TODAY, "11:45"), fake);
		expect(digestsOf(fake)).toHaveLength(1);

		await resetDb();
		const other = await setup();
		await runCron(at(TODAY, "12:00"), other.fake);
		expect(digestsOf(other.fake)).toHaveLength(0);
	});

	it("hides habit names when the user turns titles off", async () => {
		const { api, user, fake } = await setup();
		await patchSettings(api, user, { show_titles_in_notifications: false });

		await runCron(AT_0900, fake);
		const [digest] = digestsOf(fake);
		expect(digest?.body).toBe("Você tem compromissos hoje e amanhã.");
		expect(JSON.stringify(fake.expoSends())).not.toMatch(/filtro|Consulta/);
	});

	it("is not sent when turned off, and the reminder still works", async () => {
		const { api, user, fake } = await setup();
		await patchSettings(api, user, {
			morning_digest_enabled: false,
			reminder_time: "09:00",
		});

		const report = await runCron(AT_0900, fake);
		expect(report).toMatchObject({ digests: 0, reminders: 1 });
	});

	it("sends both the digest and the reminder when they share a time", async () => {
		const { api, user, fake } = await setup();
		await patchSettings(api, user, { reminder_time: "09:00" });

		const report = await runCron(AT_0900, fake);
		expect(report).toMatchObject({
			digests: 1,
			reminders: 1,
			usersNotified: 1,
		});
		const tags = fake
			.expoSends()
			.flat()
			.map((m) => (m.data as { kind: string }).kind);
		expect(tags.sort()).toEqual(["digest", "reminder"]);
	});

	it("is not sent when everything today is done and nothing happens tomorrow", async () => {
		const { api, user, fake } = await setup();
		api.setNow(at("2026-11-20", "08:00"));
		// On the 20th: Ler (daily) and the appointment; the filter is not due.
		const habits = (await (
			await api.request("/v1/habits", {
				headers: { ...user.auth(), [SCHEDULE_VERSION_HEADER]: "2" },
			})
		).json()) as { habits: { id: string; name: string }[] };
		for (const habit of habits.habits) {
			if (habit.name === "Trocar filtro") continue;
			const done = await api.request(
				`/v1/habits/${habit.id}/completions/2026-11-20`,
				json({ completed: true }, { method: "PUT", headers: user.auth() })
			);
			expect(done.status).toBe(200);
		}
		await runCron(at("2026-11-20", "09:00"), fake);
		expect(digestsOf(fake)).toHaveLength(0);
	});

	it("reaches web devices too, and keeps going when one device fails", async () => {
		const { api, user } = await setup();
		for (const name of ["gone", "ok"]) {
			const response = await api.request(
				"/v1/push/subscriptions",
				json(
					{
						kind: "webpush",
						endpoint: `https://push.example.com/${name}`,
						keys: await newWebPushKeys(),
					},
					{ method: "POST", headers: user.auth() }
				)
			);
			expect(response.status).toBe(200);
		}
		const fake = fakePushFetch({
			web: { "https://push.example.com/gone": 410 },
		});
		const report = await runCron(AT_0900, fake);
		expect(report).toMatchObject({ digests: 1, sent: 2, removed: 1 });
	});
});
