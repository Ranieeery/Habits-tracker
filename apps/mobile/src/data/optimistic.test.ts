import { describe, expect, it } from "vitest";
import { withCompletion, withSummaryDay } from "./optimistic.ts";
import type { DayData } from "./repository.ts";

const A = "0199c9a0-2222-7000-8000-000000000001";
const B = "0199c9a0-2222-7000-8000-000000000002";

const day: DayData = {
	date: "2026-10-09",
	possible_habits: [],
	completed_habit_ids: [A],
};

describe("withCompletion", () => {
	it("marks a habit done once", () => {
		expect(
			withCompletion(day, { habitId: B, completed: true }).completed_habit_ids
		).toEqual([A, B]);
		expect(
			withCompletion(day, { habitId: A, completed: true }).completed_habit_ids
		).toEqual([A]);
	});

	it("marks a habit undone, and undoing twice is a no-op", () => {
		const undone = withCompletion(day, { habitId: A, completed: false });
		expect(undone.completed_habit_ids).toEqual([]);
		expect(
			withCompletion(undone, { habitId: A, completed: false })
				.completed_habit_ids
		).toEqual([]);
	});

	it("does not mutate the cached day (rollback restores it as is)", () => {
		withCompletion(day, { habitId: B, completed: true });
		expect(day.completed_habit_ids).toEqual([A]);
	});
});

describe("withSummaryDay", () => {
	const habit = (id: string) => ({
		id,
		name: id,
		schedule: { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-10-01",
		archived_at: null,
		sort_key: "a0",
		created_at: 0,
		updated_at: 0,
		deleted_at: null,
	});
	const today: DayData = {
		date: "2026-10-09",
		possible_habits: [habit(A), habit(B)],
		completed_habit_ids: [A],
	};

	it("replaces the day's counts and keeps the other days", () => {
		const summary = [
			{ date: "2026-10-08", completed: 1, possible: 1 },
			{ date: "2026-10-09", completed: 0, possible: 2 },
		];
		expect(withSummaryDay(summary, today)).toEqual([
			{ date: "2026-10-08", completed: 1, possible: 1 },
			{ date: "2026-10-09", completed: 1, possible: 2 },
		]);
	});

	it("adds a missing day in date order and ignores ids that are not possible", () => {
		const summary = [{ date: "2026-10-10", completed: 0, possible: 1 }];
		expect(
			withSummaryDay(summary, {
				...today,
				completed_habit_ids: [A, B, "not-possible"],
			})
		).toEqual([
			{ date: "2026-10-09", completed: 2, possible: 2 },
			{ date: "2026-10-10", completed: 0, possible: 1 },
		]);
	});

	it("drops days with nothing possible", () => {
		expect(
			withSummaryDay([{ date: "2026-10-09", completed: 0, possible: 1 }], {
				...today,
				possible_habits: [],
				completed_habit_ids: [],
			})
		).toEqual([]);
	});
});

describe("withSummaryDay with overdue habits (2.8.0)", () => {
	const habit = (id: string) => ({
		id,
		name: id,
		schedule: { type: "monthly_days" as const, days: [5] },
		start_date: "2026-10-01",
		archived_at: null,
		sort_key: "a0",
		created_at: 0,
		updated_at: 0,
		deleted_at: null,
	});
	const today: DayData = {
		date: "2026-10-09",
		possible_habits: [],
		completed_habit_ids: [],
		overdue: [{ habit: habit(A), since: "2026-10-05", completed_today: false }],
	};

	it("leaves a pending overdue habit out and counts it once marked", () => {
		expect(withSummaryDay([], today)).toEqual([]);
		const marked = withCompletion(today, { habitId: A, completed: true });
		expect(withSummaryDay([], marked)).toEqual([
			{ date: "2026-10-09", completed: 1, possible: 1 },
		]);
	});
});
