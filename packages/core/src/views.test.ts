import type { Completion, Habit } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { dayView, summarizeYear } from "./views.ts";
import { NO_RESCHEDULES } from "./reschedule-index.ts";

const options = { reschedules: NO_RESCHEDULES, timeZone: "America/Sao_Paulo" };

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
	return {
		id,
		name: id,
		schedule: { type: "weekdays", days: [1, 3, 5] }, // Mon, Wed, Fri
		start_date: "2025-12-29",
		archived_at: null,
		description: "",
		sort_key: "a0",
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

function completion(
	habitId: string,
	date: string,
	deleted_at: number | null = null
): Pick<Completion, "habit_id" | "date" | "deleted_at"> {
	return { habit_id: habitId, date, deleted_at };
}

const a = "00000000-0000-7000-8000-00000000000a";
const b = "00000000-0000-7000-8000-00000000000b";

describe("dayView", () => {
	it("lists possible habits and the completed ones, ignoring tombstones", () => {
		const view = dayView(
			[
				habit(a),
				habit(b),
				habit("c", { schedule: { type: "weekdays", days: [0] } }),
			],
			[completion(a, "2026-01-05"), completion(b, "2026-01-05", 9)],
			"2026-01-05", // Monday
			options
		);
		expect(view.possible_habits.map((h) => h.id)).toEqual([a, b]);
		expect(view.completed_habit_ids).toEqual([a]);
	});

	it("lists a habit completed on a day its schedule does not include", () => {
		const view = dayView(
			[habit(a), habit(b)],
			[completion(a, "2026-01-06")],
			"2026-01-06", // Tuesday: neither is scheduled
			options
		);
		expect(view.possible_habits.map((h) => h.id)).toEqual([a]);
		expect(view.completed_habit_ids).toEqual([a]);
	});

	it("leaves out a habit whose schedule this build does not understand", () => {
		const view = dayView(
			[habit(a, { schedule: { type: "lunar" } })],
			[],
			"2026-01-05",
			options
		);
		expect(view.possible_habits).toEqual([]);
	});
});

describe("summarizeYear", () => {
	it("counts each possible day up to today, across the year boundary", () => {
		const days = summarizeYear(
			[habit(a), habit(b)],
			[
				completion(a, "2025-12-31"), // previous year: ignored
				completion(a, "2026-01-02"),
				completion(b, "2026-01-02"),
				completion(a, "2026-01-05", 3),
			],
			{ year: 2026, today: "2026-01-07", ...options }
		);
		expect(days).toEqual([
			{ date: "2026-01-02", possible: 2, completed: 2 },
			{ date: "2026-01-05", possible: 2, completed: 0 },
			{ date: "2026-01-07", possible: 2, completed: 0 },
		]);
	});

	it("is empty for a year after today", () => {
		expect(
			summarizeYear([habit(a)], [], {
				year: 2027,
				today: "2026-12-31",
				...options,
			})
		).toEqual([]);
	});
});
