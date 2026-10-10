import { describe, expect, it } from "vitest";
import { withCompletion } from "./optimistic.ts";
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
