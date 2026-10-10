import { describe, expect, it } from "vitest";
import {
	ApiError,
	CalendarDate,
	Completion,
	Habit,
	Mutation,
	Schedule,
	SyncPullResponse,
	TimeZone,
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

		const upsert = Mutation.parse({
			mutation_id: id,
			created_at: 1_767_800_000_000,
			type: "habit.upsert",
			record: habit,
		});
		expect(upsert.type === "habit.upsert" && upsert.record.name).toBe(
			"Beber água"
		);
	});

	it("rejects a mutation without mutation_id or with an unknown type", () => {
		expect(
			Mutation.safeParse({
				created_at: 1,
				type: "habit.upsert",
				record: habit,
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

describe("SyncPullResponse", () => {
	it("carries tombstones", () => {
		const response = SyncPullResponse.parse({
			cursor: "c1",
			has_more: false,
			changes: { habits: [{ ...habit, deleted_at: 5 }], completions: [] },
		});
		expect(response.changes.habits[0]?.deleted_at).toBe(5);
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
