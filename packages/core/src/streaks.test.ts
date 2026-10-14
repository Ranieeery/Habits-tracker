import { describe, expect, it } from "vitest";
import type { SchedulableHabit } from "./schedule.ts";
import { dayStreaks, habitStreaks } from "./streaks.ts";
import { NO_RESCHEDULES } from "./reschedule-index.ts";

const sp = { reschedules: NO_RESCHEDULES, timeZone: "America/Sao_Paulo" };

function daily(start_date: string): SchedulableHabit {
	return {
		id: "h",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date,
		archived_at: null,
		deleted_at: null,
	};
}

describe("habitStreaks", () => {
	it("continues across the year boundary", () => {
		const done = [
			"2025-12-29",
			"2025-12-30",
			"2025-12-31",
			"2026-01-01",
			"2026-01-02",
		];
		expect(habitStreaks(daily("2025-12-29"), done, "2026-01-02", sp)).toEqual({
			current: 5,
			longest: 5,
		});
	});

	it("does not break the current streak while today is still open", () => {
		const done = ["2025-12-31", "2026-01-01"];
		expect(habitStreaks(daily("2025-12-31"), done, "2026-01-02", sp)).toEqual({
			current: 2,
			longest: 2,
		});
	});

	it("breaks on a missed past day and keeps the longest run", () => {
		const done = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"];
		expect(habitStreaks(daily("2026-01-01"), done, "2026-01-05", sp)).toEqual({
			current: 1,
			longest: 3,
		});
	});

	it("skips days the habit is not scheduled for", () => {
		// Mondays and Fridays only; done on every scheduled day.
		const habit = {
			...daily("2026-01-01"),
			schedule: { type: "weekdays" as const, days: [1, 5] },
		};
		const done = ["2026-01-02", "2026-01-05", "2026-01-09", "2026-01-12"];
		expect(habitStreaks(habit, done, "2026-01-14", sp)).toEqual({
			current: 4,
			longest: 4,
		});
	});

	it("starts at start_date for a habit created mid-week", () => {
		// Created Wednesday 2026-01-07; earlier days are not missed days.
		const done = ["2026-01-07", "2026-01-08"];
		expect(habitStreaks(daily("2026-01-07"), done, "2026-01-08", sp)).toEqual({
			current: 2,
			longest: 2,
		});
	});

	it("stops counting after the habit is archived", () => {
		const archived = {
			...daily("2026-01-01"),
			archived_at: Date.UTC(2026, 0, 3, 15), // 2026-01-03 12:00 in São Paulo
		};
		const done = ["2026-01-01", "2026-01-02", "2026-01-03"];
		expect(habitStreaks(archived, done, "2026-01-10", sp)).toEqual({
			current: 3,
			longest: 3,
		});
	});

	it("is zero when nothing was done", () => {
		expect(habitStreaks(daily("2026-01-01"), [], "2026-01-05", sp)).toEqual({
			current: 0,
			longest: 0,
		});
	});
});

describe("dayStreaks", () => {
	it("counts perfect days across the year boundary, skipping empty days", () => {
		const summary = [
			{ date: "2025-12-30", completed: 1, possible: 2 },
			{ date: "2025-12-31", completed: 2, possible: 2 },
			// 2026-01-01: nothing possible, omitted
			{ date: "2026-01-02", completed: 3, possible: 3 },
			{ date: "2026-01-03", completed: 0, possible: 3 }, // today, still open
		];
		expect(dayStreaks(summary, "2026-01-03")).toEqual({
			current: 2,
			longest: 2,
		});
	});

	it("is zero without data", () => {
		expect(dayStreaks([], "2026-01-03")).toEqual({ current: 0, longest: 0 });
	});
});
