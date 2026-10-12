import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_FETCHES_PER_RUN } from "../src/cron/reminders.ts";
import {
	pushSubscriptions,
	pushTickets,
	reminderState,
} from "../src/db/schema.ts";
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
import {
	type FakePushOptions,
	fakePushFetch,
	newVapidKeys,
	newWebPushKeys,
} from "./push-fakes.ts";

beforeEach(resetDb);

/** 20:15 in São Paulo (UTC-3). */
const AT_2015 = "2026-10-10T23:15:00Z";
const TODAY = "2026-10-10";
const EXPO_TOKEN = "ExponentPushToken[pixel-9-token]";

let overrides: EnvOverrides;

async function vapidOverrides(): Promise<EnvOverrides> {
	const vapid = await newVapidKeys();
	return {
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: vapid.subject,
		ALLOW_SIGNUP: "true",
	};
}

function runCron(at: string, fake: ReturnType<typeof fakePushFetch>) {
	return runScheduled({
		env: { ...env, ...overrides } as Env,
		now: Date.parse(at),
		fetch: fake.fetch,
	});
}

async function addWebDevice(api: TestApi, user: TestUser, name: string) {
	const endpoint = `https://push.example.com/${name}`;
	const response = await api.request(
		"/v1/push/subscriptions",
		json(
			{ kind: "webpush", endpoint, keys: await newWebPushKeys() },
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(response.status).toBe(200);
	return endpoint;
}

async function addExpoDevice(api: TestApi, user: TestUser, token = EXPO_TOKEN) {
	const response = await api.request(
		"/v1/push/subscriptions",
		json({ kind: "expo", token }, { method: "POST", headers: user.auth() })
	);
	expect(response.status).toBe(200);
}

/** A user with reminders at `reminderTime` and one habit due every day. */
async function setupUser(
	api: TestApi,
	email: string,
	{ reminderTime = "20:00", timezone = "America/Sao_Paulo" } = {}
) {
	const user = await createUser(api, email);
	const settings = await api.request(
		"/v1/settings",
		json(
			{ reminder_time: reminderTime, timezone },
			{ method: "PATCH", headers: user.auth() }
		)
	);
	expect(settings.status).toBe(200);
	const habit = await api.request(
		"/v1/habits",
		json(
			{
				name: "Ler um capítulo secreto",
				schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
				start_date: "2026-10-05",
			},
			{ method: "POST", headers: user.auth() }
		)
	);
	expect(habit.status).toBe(201);
	const { habit: created } = (await habit.json()) as { habit: { id: string } };
	return { user, habitId: created.id };
}

async function setup(fakeOptions: FakePushOptions = {}) {
	overrides = await vapidOverrides();
	const api = makeApi(AT_2015, overrides);
	const { user, habitId } = await setupUser(api, "owner@example.com");
	const fake = fakePushFetch(fakeOptions);
	return { api, user, habitId, fake };
}

const deviceCount = async (userId: string) =>
	(
		await db
			.select()
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.user_id, userId))
	).length;

describe("reminder cron", () => {
	it("sends one reminder after the reminder time, then nothing more that day", async () => {
		const { api, user, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		await addExpoDevice(api, user);

		const early = await runCron("2026-10-10T22:45:00Z", fake); // 19:45
		expect(early.usersNotified).toBe(0);
		expect(fake.requests).toHaveLength(0);

		const report = await runCron(AT_2015, fake);
		expect(report).toMatchObject({ usersNotified: 1, sent: 2, failed: 0 });
		expect(fake.web()).toHaveLength(1);
		const [messages] = fake.expoSends();
		expect(messages).toEqual([
			expect.objectContaining({
				to: EXPO_TOKEN,
				title: "Habits",
				body: "Você tem 1 hábito pendente hoje.",
				data: { url: "/day/hoje", kind: "reminder" },
				channelId: "reminders",
			}),
		]);
		// The habit name never goes to the lock screen.
		expect(JSON.stringify(messages)).not.toContain("secreto");

		fake.clear();
		await runCron("2026-10-10T23:30:00Z", fake);
		await runCron("2026-10-11T02:45:00Z", fake); // 23:45, same local day
		expect(fake.web()).toHaveLength(0);
		expect(fake.expoSends()).toHaveLength(0);

		const [state] = await db
			.select()
			.from(reminderState)
			.where(eq(reminderState.user_id, user.id));
		expect(state?.last_reminder_date).toBe(TODAY);

		// Next local day, after 20:00 again.
		await runCron("2026-10-11T23:15:00Z", fake);
		expect(fake.web()).toHaveLength(1);
	});

	it("sends once when two runs overlap", async () => {
		const { api, user, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		await addExpoDevice(api, user);

		const reports = await Promise.all([
			runCron(AT_2015, fake),
			runCron(AT_2015, fake),
		]);

		expect(reports.map((r) => r.usersNotified).sort()).toEqual([0, 1]);
		expect(fake.web()).toHaveLength(1);
		expect(fake.expoSends()).toHaveLength(1);
	});

	it("follows the user's time zone", async () => {
		overrides = await vapidOverrides();
		const api = makeApi(AT_2015, overrides);
		const { user } = await setupUser(api, "tokyo@example.com", {
			timezone: "Asia/Tokyo",
		});
		const fake = fakePushFetch();
		await addWebDevice(api, user, "chrome");

		// 23:15Z is 08:15 in Tokyo: before 20:00 there.
		await runCron(AT_2015, fake);
		expect(fake.requests).toHaveLength(0);
		// 11:15Z is 20:15 in Tokyo.
		await runCron("2026-10-11T11:15:00Z", fake);
		expect(fake.web()).toHaveLength(1);
	});

	it("does not send when every habit is done (and leaves the day unclaimed)", async () => {
		const { api, user, habitId, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		const done = await api.request(
			`/v1/habits/${habitId}/completions/${TODAY}`,
			json({ completed: true }, { method: "PUT", headers: user.auth() })
		);
		expect(done.status).toBe(200);

		const report = await runCron(AT_2015, fake);

		expect(report.usersNotified).toBe(0);
		expect(fake.requests).toHaveLength(0);
		// Decided before claiming (2.2.0): nothing to send claims nothing.
		const [state] = await db
			.select()
			.from(reminderState)
			.where(eq(reminderState.user_id, user.id));
		expect(state?.last_reminder_date ?? null).toBeNull();
	});

	it("does not send long after the reminder time (grace window)", async () => {
		const { api, user, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		// 21:15 in São Paulo: past REMINDER_GRACE_MINUTES after 20:00.
		const report = await runCron("2026-10-11T00:15:00Z", fake);
		expect(report.usersDue).toBe(0);
		expect(fake.requests).toHaveLength(0);
	});

	it("does not send when reminders are off", async () => {
		const { api, user, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		await api.request(
			"/v1/settings",
			json({ reminder_time: null }, { method: "PATCH", headers: user.auth() })
		);

		const report = await runCron(AT_2015, fake);

		expect(report.usersDue).toBe(0);
		expect(fake.requests).toHaveLength(0);
	});

	it("removes web devices on 404/410, keeps them on other errors, and still reaches the rest", async () => {
		const { api, user, fake } = await setup({
			web: {
				"https://push.example.com/gone-404": 404,
				"https://push.example.com/gone-410": 410,
				"https://push.example.com/flaky": 503,
			},
		});
		for (const name of ["gone-404", "gone-410", "flaky", "ok"]) {
			await addWebDevice(api, user, name);
		}
		await addExpoDevice(api, user);

		const report = await runCron(AT_2015, fake);

		expect(report).toMatchObject({ sent: 2, failed: 1, removed: 2 });
		const left = await db
			.select({ endpoint: pushSubscriptions.endpoint })
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.user_id, user.id));
		expect(left.map((row) => row.endpoint ?? "expo").sort()).toEqual([
			"expo",
			"https://push.example.com/flaky",
			"https://push.example.com/ok",
		]);
	});

	it("keeps devices when the Expo service itself fails", async () => {
		const { api, user, fake } = await setup({ expoSendStatus: 503 });
		await addWebDevice(api, user, "chrome");
		await addExpoDevice(api, user);

		const report = await runCron(AT_2015, fake);

		expect(report).toMatchObject({ sent: 1, failed: 1, removed: 0 });
		expect(await deviceCount(user.id)).toBe(2);
	});

	it("removes an Expo device reported in the ticket as DeviceNotRegistered", async () => {
		const { api, user, fake } = await setup({
			expoTickets: {
				[EXPO_TOKEN]: {
					status: "error",
					details: { error: "DeviceNotRegistered" },
				},
			},
		});
		await addExpoDevice(api, user);

		const report = await runCron(AT_2015, fake);

		expect(report).toMatchObject({ sent: 0, removed: 1 });
		expect(await deviceCount(user.id)).toBe(0);
	});

	it("reads receipts on a later run and removes DeviceNotRegistered devices", async () => {
		const other = "ExponentPushToken[tablet-token]";
		const { api, user, fake } = await setup({
			receipts: {
				"ticket-1": {
					status: "error",
					details: { error: "DeviceNotRegistered" },
				},
				"ticket-2": { status: "ok" },
			},
		});
		await addExpoDevice(api, user);
		await addExpoDevice(api, user, other);

		await runCron(AT_2015, fake);
		const tickets = await db.select().from(pushTickets);
		expect(tickets).toHaveLength(2);
		const kept = tickets.find((t) => t.id === "ticket-2")!.subscription_id;

		// Receipts are read only after 15 minutes.
		fake.clear();
		await runCron("2026-10-10T23:20:00Z", fake);
		expect(fake.receiptRequests()).toHaveLength(0);

		const report = await runCron("2026-10-10T23:30:00Z", fake);
		expect(fake.receiptRequests()).toHaveLength(1);
		expect(report.devicesRemovedByReceipts).toBe(1);
		expect(await db.select().from(pushTickets)).toHaveLength(0);
		const left = await db
			.select({ id: pushSubscriptions.id })
			.from(pushSubscriptions);
		expect(left).toEqual([{ id: kept }]);
	});

	it("keeps tickets without a receipt, and forgets them after 24 hours", async () => {
		const { api, user, fake } = await setup();
		await addExpoDevice(api, user);
		await runCron(AT_2015, fake);

		await runCron("2026-10-10T23:45:00Z", fake);
		expect(await db.select().from(pushTickets)).toHaveLength(1);

		// A day later (that run also sends the next day's reminder: ticket-2).
		await runCron("2026-10-11T23:16:00Z", fake);
		const ids = (await db.select().from(pushTickets)).map((t) => t.id);
		expect(ids).toEqual(["ticket-2"]);
		expect(await deviceCount(user.id)).toBe(1);
	});

	it("stays within the subrequest budget and defers whoever does not fit", async () => {
		overrides = await vapidOverrides();
		const api = makeApi(AT_2015, overrides);
		const fake = fakePushFetch();
		const first = (await setupUser(api, "a@example.com")).user;
		const second = (await setupUser(api, "b@example.com")).user;
		for (let i = 0; i < 30; i++) await addWebDevice(api, first, `a-${i}`);
		for (let i = 0; i < 30; i++) await addWebDevice(api, second, `b-${i}`);

		const report = await runCron(AT_2015, fake);
		expect(fake.requests.length).toBeLessThanOrEqual(MAX_FETCHES_PER_RUN);
		expect(report).toMatchObject({ usersNotified: 1, usersDeferred: 1 });

		fake.clear();
		const next = await runCron("2026-10-10T23:30:00Z", fake);
		expect(next).toMatchObject({ usersNotified: 1, usersDeferred: 0 });
		expect(fake.web()).toHaveLength(30);
	});

	it("reaches the first devices of a user with more than one run can send", async () => {
		const { api, user, fake } = await setup();
		for (let i = 0; i < MAX_FETCHES_PER_RUN + 5; i++) {
			await addWebDevice(api, user, `d-${i}`);
		}

		const report = await runCron(AT_2015, fake);

		expect(report.usersNotified).toBe(1);
		expect(fake.web()).toHaveLength(MAX_FETCHES_PER_RUN);
	});

	it("skips web devices when the VAPID keys are missing", async () => {
		const { api, user, fake } = await setup();
		await addWebDevice(api, user, "chrome");
		await addExpoDevice(api, user);
		overrides = {
			VAPID_PUBLIC_KEY: "",
			VAPID_PRIVATE_KEY: "",
			VAPID_SUBJECT: "",
		};

		const report = await runCron(AT_2015, fake);

		expect(report).toMatchObject({ sent: 1, failed: 1, removed: 0 });
		expect(fake.web()).toHaveLength(0);
	});
});
