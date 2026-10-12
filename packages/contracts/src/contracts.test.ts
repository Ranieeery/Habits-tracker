import { describe, expect, it } from "vitest";
import {
	ApiError,
	CreateHabitRequest,
	SortKey,
	UpdateHabitRequest,
	CalendarDate,
	Completion,
	Habit,
	Mutation,
	PASSWORD_MIN_LENGTH,
	PushNotificationPayload,
	PushSubscription,
	PushSubscriptionView,
	PushTestResponse,
	RegisterPushSubscriptionRequest,
	isSupportedSchedule,
	Schedule,
	SCHEDULE_TYPE_VERSION,
	scheduleVersionOf,
	SignInRequest,
	SignUpRequest,
	SYNC_PUSH_MAX_MUTATIONS,
	SyncPullResponse,
	SyncPushEnvelope,
	TimeZone,
	UpdateUserSettingsRequest,
	UserSettings,
} from "./index.ts";

const id = "01928c6e-8a3f-7b2e-9c1d-2f3a4b5c6d7e";
const habitId = "01928c6e-8a3f-7b2e-9c1d-2f3a4b5c6d7f";

const habit = {
	id: habitId,
	name: "Beber água",
	schedule: { type: "weekdays", days: [1, 3, 5] },
	start_date: "2026-01-07",
	archived_at: null,
	created_at: 1_767_787_200_000,
	updated_at: 1_767_787_200_000,
	deleted_at: null,
};

describe("CalendarDate", () => {
	it.each(["2026-01-01", "2024-02-29", "2026-12-31"])("accepts %s", (date) => {
		expect(CalendarDate.safeParse(date).success).toBe(true);
	});

	it.each(["2025-02-29", "2026-13-01", "2026-1-1", "2026-01-01T00:00:00Z", ""])(
		"rejects %s",
		(date) => {
			expect(CalendarDate.safeParse(date).success).toBe(false);
		}
	);
});

describe("Schedule", () => {
	it("accepts weekdays", () => {
		expect(Schedule.parse({ type: "weekdays", days: [0, 6] })).toEqual({
			type: "weekdays",
			days: [0, 6],
		});
	});

	it.each([
		["no days", []],
		["duplicate days", [1, 1]],
		["day 7", [7]],
		["fractional day", [1.5]],
	])("rejects %s", (_, days) => {
		expect(Schedule.safeParse({ type: "weekdays", days }).success).toBe(false);
	});

	it("rejects unknown schedule types", () => {
		expect(Schedule.safeParse({ type: "monthly", days: [1] }).success).toBe(
			false
		);
	});

	it.each([
		{ type: "interval", every: 8, anchor_date: "2026-10-22" },
		{ type: "interval", every: 366, anchor_date: "2026-10-22" },
		{ type: "monthly_days", days: [20] },
		{ type: "monthly_days", days: [1, 15, 31] },
		{ type: "once", date: "2026-11-20" },
		{ type: "yearly", month: 11, day: 20 },
		{ type: "yearly", month: 2, day: 29 },
	])("accepts %j", (schedule) => {
		expect(Schedule.safeParse(schedule).success).toBe(true);
	});

	it.each([
		{ type: "interval", every: 0, anchor_date: "2026-10-22" },
		{ type: "interval", every: 367, anchor_date: "2026-10-22" },
		{ type: "interval", every: 1.5, anchor_date: "2026-10-22" },
		{ type: "interval", every: 2, anchor_date: "2026-02-30" },
		{ type: "monthly_days", days: [] },
		{ type: "monthly_days", days: [0] },
		{ type: "monthly_days", days: [32] },
		{ type: "monthly_days", days: [5, 5] },
		{ type: "once", date: "20/11/2026" },
		{ type: "yearly", month: 13, day: 1 },
		{ type: "yearly", month: 2, day: 30 },
		{ type: "yearly", month: 4, day: 31 },
	])("rejects %j", (schedule) => {
		expect(Schedule.safeParse(schedule).success).toBe(false);
	});

	it("versions each type; weekdays is what 2.1.0 clients understand", () => {
		expect(SCHEDULE_TYPE_VERSION.weekdays).toBe(1);
		expect(scheduleVersionOf({ type: "weekdays", days: [1] })).toBe(1);
		expect(scheduleVersionOf({ type: "once", date: "2026-11-20" })).toBe(2);
		expect(scheduleVersionOf({ type: "lunar" })).toBe(Infinity);
	});
});

describe("Habit (tolerant reads)", () => {
	it("keeps a schedule from a newer version instead of failing", () => {
		const parsed = Habit.parse({
			...habit,
			schedule: { type: "lunar", phase: "full" },
		});
		expect(parsed.schedule).toEqual({ type: "lunar", phase: "full" });
		expect(isSupportedSchedule(parsed.schedule)).toBe(false);
	});

	it("still requires an object with a string type", () => {
		expect(Habit.safeParse({ ...habit, schedule: { days: [1] } }).success).toBe(
			false
		);
	});
});

describe("Habit and Completion", () => {
	it("accept a live record and a tombstone", () => {
		expect(Habit.safeParse(habit).success).toBe(true);
		expect(
			Habit.safeParse({ ...habit, deleted_at: 1_767_800_000_000 }).success
		).toBe(true);
	});

	it("trim the name and reject a blank one", () => {
		expect(Habit.parse({ ...habit, name: "  Ler  " }).name).toBe("Ler");
		expect(Habit.safeParse({ ...habit, name: "   " }).success).toBe(false);
	});

	it("require integer ms timestamps", () => {
		expect(Habit.safeParse({ ...habit, updated_at: 1.5 }).success).toBe(false);
		expect(
			Habit.safeParse({ ...habit, created_at: "2026-01-07T00:00:00Z" }).success
		).toBe(false);
	});

	it("require deleted_at to be present (null when live)", () => {
		const { deleted_at: _, ...withoutDeletedAt } = habit;
		expect(Habit.safeParse(withoutDeletedAt).success).toBe(false);
	});

	it("parse a completion", () => {
		const completion = {
			id,
			habit_id: habitId,
			date: "2026-01-07",
			completed_at: 1_767_800_000_000,
			created_at: 1_767_800_000_000,
			updated_at: 1_767_800_000_000,
			deleted_at: null,
		};
		expect(Completion.safeParse(completion).success).toBe(true);
	});
});

describe("Mutation", () => {
	it("discriminates by type", () => {
		const mutation = Mutation.parse({
			mutation_id: id,
			created_at: 1_767_800_000_000,
			type: "completion.set",
			id,
			habit_id: habitId,
			date: "2026-01-07",
			completed: false,
			updated_at: 1_767_800_000_000,
		});
		expect(mutation.type).toBe("completion.set");

		const create = Mutation.parse({
			mutation_id: id,
			created_at: 1_767_800_000_000,
			type: "habit.create",
			id: habitId,
			name: "Beber água",
			schedule: { type: "weekdays", days: [1, 3, 5] },
			start_date: "2026-01-07",
		});
		expect(create.type === "habit.create" && create.name).toBe("Beber água");

		const update = Mutation.parse({
			mutation_id: id,
			created_at: 1_767_800_000_000,
			type: "habit.update",
			habit_id: habitId,
			changes: { archived: true },
		});
		expect(update.type === "habit.update" && update.changes).toEqual({
			archived: true,
		});
	});

	it("does not require the client's updated_at on completion.set", () => {
		expect(
			Mutation.safeParse({
				mutation_id: id,
				created_at: 1,
				type: "completion.set",
				id,
				habit_id: habitId,
				date: "2026-01-07",
				completed: true,
			}).success
		).toBe(true);
	});

	it("rejects a mutation without mutation_id or with an unknown type", () => {
		expect(
			Mutation.safeParse({
				created_at: 1,
				type: "habit.create",
				id: habitId,
				name: "Beber água",
				schedule: { type: "weekdays", days: [1] },
				start_date: "2026-01-07",
			}).success
		).toBe(false);
		expect(
			Mutation.safeParse({
				mutation_id: id,
				created_at: 1,
				type: "habit.explode",
			}).success
		).toBe(false);
	});
});

describe("SyncPushEnvelope", () => {
	it("only checks mutation ids, so each mutation is parsed on its own", () => {
		const envelope = SyncPushEnvelope.parse({
			protocol: 1,
			mutations: [{ mutation_id: id, type: "habit.explode", extra: 1 }],
		});
		expect(envelope.mutations[0]).toMatchObject({ type: "habit.explode" });
		expect(
			SyncPushEnvelope.safeParse({
				protocol: 1,
				mutations: [{ type: "completion.set" }],
			}).success
		).toBe(false);
	});

	it("caps the batch size", () => {
		const mutations = Array.from(
			{ length: SYNC_PUSH_MAX_MUTATIONS + 1 },
			() => ({ mutation_id: id })
		);
		expect(SyncPushEnvelope.safeParse({ protocol: 1, mutations }).success).toBe(
			false
		);
	});
});

describe("SyncPullResponse", () => {
	it("carries tombstones", () => {
		const response = SyncPullResponse.parse({
			cursor: "c1",
			has_more: false,
			changes: { habits: [{ ...habit, deleted_at: 5 }], completions: [] },
		});
		expect(response.changes.habits[0]?.deleted_at).toBe(5);
		expect(response.reset).toBeUndefined();
	});
});

describe("ApiError", () => {
	it("accepts error codes the client does not know yet", () => {
		expect(
			ApiError.safeParse({
				error: { code: "rate_limited", message: "Slow down" },
			}).success
		).toBe(true);
	});
});

describe("TimeZone", () => {
	it("accepts IANA names and rejects garbage", () => {
		expect(TimeZone.safeParse("America/Sao_Paulo").success).toBe(true);
		expect(TimeZone.safeParse("Mars/Olympus_Mons").success).toBe(false);
	});
});

describe("UserSettings", () => {
	const settings = {
		timezone: "America/Sao_Paulo",
		reminder_time: "21:30",
		morning_digest_enabled: true,
		show_titles_in_notifications: false,
		created_at: 1_767_787_200_000,
		updated_at: 1_767_787_200_000,
	};

	it("accepts a reminder time or null", () => {
		expect(UserSettings.safeParse(settings).success).toBe(true);
		expect(
			UserSettings.safeParse({ ...settings, reminder_time: null }).success
		).toBe(true);
	});

	it("defaults the 2.2.0 notification flags to on (older stored copies)", () => {
		const { morning_digest_enabled, show_titles_in_notifications, ...old } =
			settings;
		expect(UserSettings.parse(old)).toMatchObject({
			morning_digest_enabled: true,
			show_titles_in_notifications: true,
		});
		expect([morning_digest_enabled, show_titles_in_notifications]).toEqual([
			true,
			false,
		]);
	});

	it.each(["00:00", "08:15", "12:30", "23:45"])(
		"accepts reminder time %s (15-minute steps)",
		(reminder_time) => {
			expect(
				UserSettings.safeParse({ ...settings, reminder_time }).success
			).toBe(true);
		}
	);

	it.each(["24:00", "9:00", "12:60", "12:00:00", "20:07", "23:50"])(
		"rejects reminder time %s",
		(reminder_time) => {
			expect(
				UserSettings.safeParse({ ...settings, reminder_time }).success
			).toBe(false);
		}
	);
});

describe("PushSubscription", () => {
	const base = {
		id,
		device_label: "Pixel 9",
		last_seen_at: 1_767_787_200_000,
		created_at: 1_767_787_200_000,
		updated_at: 1_767_787_200_000,
	};

	it("accepts web push and expo subscriptions", () => {
		expect(
			PushSubscription.safeParse({
				...base,
				kind: "webpush",
				endpoint: "https://push.example.com/send/abc",
				p256dh: "BNc",
				auth: "tBH",
			}).success
		).toBe(true);
		expect(
			PushSubscription.safeParse({
				...base,
				kind: "expo",
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
			}).success
		).toBe(true);
	});

	it("rejects missing kind fields and unknown kinds", () => {
		expect(
			PushSubscription.safeParse({
				...base,
				kind: "webpush",
				endpoint: "https://push.example.com/send/abc",
			}).success
		).toBe(false);
		expect(
			PushSubscription.safeParse({ ...base, kind: "expo", token: "abc" })
				.success
		).toBe(false);
		expect(
			PushSubscription.safeParse({ ...base, kind: "sms", token: "x" }).success
		).toBe(false);
	});
});

describe("auth requests", () => {
	it("requires passwords of at least PASSWORD_MIN_LENGTH characters", () => {
		const request = { name: "Dono", email: "owner@example.com" };
		const ok = "a".repeat(PASSWORD_MIN_LENGTH);
		expect(SignUpRequest.safeParse({ ...request, password: ok }).success).toBe(
			true
		);
		expect(
			SignUpRequest.safeParse({ ...request, password: ok.slice(1) }).success
		).toBe(false);
		expect(
			SignUpRequest.safeParse({ ...request, password: "a".repeat(129) }).success
		).toBe(false);
	});

	it("rejects invalid emails", () => {
		expect(
			SignInRequest.safeParse({ email: "nope", password: "x" }).success
		).toBe(false);
	});
});

describe("RegisterPushSubscriptionRequest", () => {
	it("accepts the browser toJSON() shape and expo tokens", () => {
		expect(
			RegisterPushSubscriptionRequest.safeParse({
				kind: "webpush",
				endpoint: "https://push.example.com/send/abc",
				keys: { p256dh: "BNc", auth: "tBH" },
			}).success
		).toBe(true);
		expect(
			RegisterPushSubscriptionRequest.safeParse({
				kind: "expo",
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
				device_label: "Pixel 9",
			}).success
		).toBe(true);
	});

	it("rejects web push without keys", () => {
		expect(
			RegisterPushSubscriptionRequest.safeParse({
				kind: "webpush",
				endpoint: "https://push.example.com/send/abc",
			}).success
		).toBe(false);
	});
});

describe("PushSubscriptionView", () => {
	it("strips the endpoint, keys and token", () => {
		const view = PushSubscriptionView.parse({
			id,
			kind: "webpush",
			device_label: null,
			last_seen_at: 1,
			created_at: 1,
			updated_at: 1,
			endpoint: "https://push.example.com/send/abc",
			p256dh: "BNc",
			auth: "tBH",
			token: "ExponentPushToken[x]",
		});
		expect(Object.keys(view).sort()).toEqual([
			"created_at",
			"device_label",
			"id",
			"kind",
			"last_seen_at",
			"updated_at",
		]);
	});
});

describe("UpdateUserSettingsRequest", () => {
	it("accepts partial updates and validates each field", () => {
		expect(UpdateUserSettingsRequest.safeParse({}).success).toBe(true);
		expect(
			UpdateUserSettingsRequest.safeParse({ reminder_time: null }).success
		).toBe(true);
		expect(
			UpdateUserSettingsRequest.safeParse({ timezone: "Mars/Olympus" }).success
		).toBe(false);
	});
});

describe("PushTestResponse", () => {
	it("has counts only", () => {
		expect(
			PushTestResponse.parse({ sent: 2, failed: 0, removed: 1, token: "x" })
		).toEqual({ sent: 2, failed: 0, removed: 1 });
	});
});

describe("PushNotificationPayload", () => {
	const payload = {
		v: 1,
		kind: "reminder",
		title: "Habits",
		body: "Você tem 2 hábitos pendentes hoje.",
		url: "/today",
		tag: "reminder-2026-10-10",
	};

	it("accepts a reminder and a morning digest", () => {
		expect(PushNotificationPayload.safeParse(payload).success).toBe(true);
		expect(
			PushNotificationPayload.safeParse({
				...payload,
				kind: "digest",
				tag: "digest-2026-10-10",
			}).success
		).toBe(true);
	});

	it("rejects external URLs and unknown versions", () => {
		expect(
			PushNotificationPayload.safeParse({
				...payload,
				url: "https://evil.example",
			}).success
		).toBe(false);
		for (const url of ["//evil.example", "/\\evil.example"]) {
			expect(
				PushNotificationPayload.safeParse({ ...payload, url }).success
			).toBe(false);
		}
		expect(
			PushNotificationPayload.safeParse({ ...payload, v: 2 }).success
		).toBe(false);
	});
});

describe("habit order (2.4.0)", () => {
	it("defaults a missing sort_key to empty (an API older than 2.4.0)", () => {
		const { sort_key: _omitted, ...withoutKey } = { ...habit, sort_key: "a0" };
		expect(Habit.parse(withoutKey).sort_key).toBe("");
		expect(Habit.parse({ ...habit, sort_key: "a0" }).sort_key).toBe("a0");
	});

	it("accepts base-62 keys up to 64 characters only", () => {
		expect(SortKey.safeParse("b0Az").success).toBe(true);
		expect(SortKey.safeParse("").success).toBe(false);
		expect(SortKey.safeParse("a-1").success).toBe(false);
		expect(SortKey.safeParse("a".repeat(65)).success).toBe(false);
	});

	it("lets create and update carry a key, and old requests still parse", () => {
		expect(UpdateHabitRequest.parse({ sort_key: "a1" })).toEqual({
			sort_key: "a1",
		});
		expect(UpdateHabitRequest.safeParse({ sort_key: "" }).success).toBe(false);
		const create = {
			name: "Ler",
			schedule: { type: "weekdays", days: [1] },
			start_date: "2026-10-09",
		};
		expect(CreateHabitRequest.parse(create).sort_key).toBeUndefined();
		expect(
			CreateHabitRequest.parse({ ...create, sort_key: "a3" }).sort_key
		).toBe("a3");
	});
});
