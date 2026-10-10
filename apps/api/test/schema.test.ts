import type { Completion, Habit } from "@habits/contracts";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.ts";
import {
	fromCompletionRow,
	fromHabitRow,
	toCompletionRow,
	toHabitRow,
	toPushSubscriptionRow,
} from "../src/db/records.ts";
import {
	completions,
	habits,
	pushSubscriptions,
	userSettings,
} from "../src/db/schema.ts";

const db = createDb(env.DB);

beforeEach(async () => {
	await db.batch([
		db.delete(completions),
		db.delete(habits),
		db.delete(userSettings),
		db.delete(pushSubscriptions),
	]);
});
const userId = "0199c9a0-0000-7000-8000-0000000000aa";
const createdAt = 1_767_787_200_000;

const habit: Habit = {
	id: "0199c9a0-0001-7000-8000-000000000001",
	name: "Ler",
	schedule: { type: "weekdays", days: [1, 3, 5] },
	start_date: "2026-01-05",
	archived_at: null,
	created_at: createdAt,
	updated_at: createdAt,
	deleted_at: null,
};

const completion: Completion = {
	id: "0199c9a0-0002-7000-8000-000000000001",
	habit_id: habit.id,
	date: "2026-01-07",
	completed_at: createdAt + 1,
	created_at: createdAt + 1,
	updated_at: createdAt + 1,
	deleted_at: null,
};

/** Asserts a write fails with a SQLite error (Drizzle wraps it in `cause`). */
async function expectSqlError(write: PromiseLike<unknown>, pattern: RegExp) {
	const error = await Promise.resolve(write).then(
		() => null,
		(error: unknown) => error
	);
	expect(error).toBeInstanceOf(Error);
	const { message, cause } = error as Error;
	expect(`${message} ${cause instanceof Error ? cause.message : ""}`).toMatch(
		pattern
	);
}

async function insertHabit() {
	await db.insert(habits).values(toHabitRow(userId, habit));
}

/** Runs raw SQL so values bypass Drizzle and the contract mappers. */
function rawInsertHabit(schedule: string, startDate = "2026-01-05") {
	return env.DB.prepare(
		`INSERT INTO habits (id, user_id, name, schedule, start_date, created_at, updated_at)
		 VALUES (?, ?, 'x', ?, ?, 1, 1)`
	)
		.bind(crypto.randomUUID(), userId, schedule, startDate)
		.run();
}

describe("completions", () => {
	it("are unique per (habit_id, date)", async () => {
		await insertHabit();
		await db.insert(completions).values(toCompletionRow(userId, completion));

		await expectSqlError(
			db.insert(completions).values(
				toCompletionRow(userId, {
					...completion,
					id: "0199c9a0-0002-7000-8000-000000000002",
				})
			),
			/UNIQUE constraint failed: completions.habit_id, completions.date/
		);
	});

	it("require an existing habit", async () => {
		await expectSqlError(
			db.insert(completions).values(toCompletionRow(userId, completion)),
			/FOREIGN KEY constraint failed/
		);
	});

	it("reject dates that are not YYYY-MM-DD", async () => {
		await insertHabit();
		for (const date of ["2026-02-30", "2026-1-7", "2026-01-07T00:00"]) {
			await expect(
				env.DB.prepare(
					`INSERT INTO completions (id, user_id, habit_id, date, completed_at, created_at, updated_at)
					 VALUES (?, ?, ?, ?, 1, 1, 1)`
				)
					.bind(crypto.randomUUID(), userId, habit.id, date)
					.run()
			).rejects.toThrow(/CHECK constraint failed/);
		}
	});
});

describe("timestamps", () => {
	it("are stored as integer ms and read back as numbers", async () => {
		await insertHabit();
		await db.insert(completions).values(toCompletionRow(userId, completion));

		const types = await env.DB.prepare(
			`SELECT typeof(completed_at) AS completed_at, typeof(created_at) AS created_at,
			        typeof(updated_at) AS updated_at, typeof(deleted_at) AS deleted_at
			 FROM completions`
		).first();
		expect(types).toEqual({
			completed_at: "integer",
			created_at: "integer",
			updated_at: "integer",
			deleted_at: "null",
		});

		const [row] = await db
			.select()
			.from(completions)
			.where(eq(completions.id, completion.id));
		expect(row?.created_at).toBe(createdAt + 1);
		expect(fromCompletionRow(row!)).toEqual(completion);

		const [habitRow] = await db.select().from(habits);
		expect(fromHabitRow(habitRow!)).toEqual(habit);
	});
});

describe("habit schedule", () => {
	it("is rejected by the database when not JSON with a string type", async () => {
		for (const schedule of ["not json", '{"days":[1]}', '{"type":1}', "[]"]) {
			await expect(rawInsertHabit(schedule)).rejects.toThrow(
				/CHECK constraint failed: habits_schedule_check/
			);
		}
	});

	it("is validated against the contract before writing", () => {
		const invalid = [
			{ type: "weekdays", days: [] },
			{ type: "weekdays", days: [7] },
			{ type: "weekdays", days: [1, 1] },
			{ type: "monthly", days: [1] },
		];
		for (const schedule of invalid) {
			expect(() =>
				toHabitRow(userId, { ...habit, schedule } as unknown as Habit)
			).toThrow();
		}
	});

	it("rejects an invalid start date", async () => {
		await expect(
			rawInsertHabit('{"type":"weekdays","days":[1]}', "2026-13-01")
		).rejects.toThrow(/CHECK constraint failed: habits_start_date_check/);
	});
});

describe("push subscriptions", () => {
	const base = {
		device_label: null,
		last_seen_at: createdAt,
		created_at: createdAt,
		updated_at: createdAt,
	};

	it("store web push and expo rows", async () => {
		await db.insert(pushSubscriptions).values([
			toPushSubscriptionRow(userId, {
				...base,
				id: "0199c9a0-0003-7000-8000-000000000001",
				kind: "webpush",
				endpoint: "https://push.example.com/a",
				p256dh: "key",
				auth: "secret",
			}),
			toPushSubscriptionRow(userId, {
				...base,
				id: "0199c9a0-0003-7000-8000-000000000002",
				kind: "expo",
				token: "ExponentPushToken[abc]",
			}),
		]);
		expect(await db.$count(pushSubscriptions)).toBe(2);
	});

	it("reject rows whose fields do not match the kind", async () => {
		const insert = (
			kind: string,
			endpoint: string | null,
			token: string | null
		) =>
			env.DB.prepare(
				`INSERT INTO push_subscriptions (id, user_id, kind, endpoint, token, last_seen_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 1, 1, 1)`
			)
				.bind(crypto.randomUUID(), userId, kind, endpoint, token)
				.run();

		await expect(insert("webpush", "https://x", null)).rejects.toThrow(
			/CHECK constraint failed/
		);
		await expect(
			insert("expo", "https://x", "ExponentPushToken[a]")
		).rejects.toThrow(/CHECK constraint failed/);
		await expect(insert("sms", null, "x")).rejects.toThrow(
			/CHECK constraint failed/
		);
	});
});
