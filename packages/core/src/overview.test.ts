import type { SummaryDay } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import {
	isStrongDay,
	overviewNeedsPreviousYear,
	overviewStats,
	periodProgress,
} from "./overview.ts";

const day = (
	date: string,
	completed: number,
	possible: number
): SummaryDay => ({
	date,
	completed,
	possible,
});

describe("isStrongDay", () => {
	it("is the top heatmap level: 80% or more", () => {
		expect(isStrongDay(day("2026-10-01", 4, 5))).toBe(true); // exactly 80%
		expect(isStrongDay(day("2026-10-01", 5, 5))).toBe(true);
		expect(isStrongDay(day("2026-10-01", 3, 4))).toBe(false); // 75%
		expect(isStrongDay(day("2026-10-01", 0, 0))).toBe(false);
	});
});

describe("periodProgress", () => {
	it("sums completed over possible inside the range only", () => {
		const days = [
			day("2026-10-03", 9, 9), // before
			day("2026-10-04", 1, 2),
			day("2026-10-05", 2, 3),
			day("2026-10-07", 9, 9), // after
		];
		expect(periodProgress(days, "2026-10-04", "2026-10-06")).toEqual({
			completed: 3,
			possible: 5,
			ratio: 0.6,
		});
	});

	it("is 0% when nothing was possible", () => {
		expect(periodProgress([], "2026-10-01", "2026-10-12")).toEqual({
			completed: 0,
			possible: 0,
			ratio: 0,
		});
	});
});

describe("overviewStats", () => {
	// Monday 2026-10-12; the week started on Sunday 2026-10-11.
	const today = "2026-10-12";

	it("counts strong days in a row, skipping days with nothing possible", () => {
		const stats = overviewStats({
			days: [
				day("2026-10-07", 1, 2), // 50%: breaks
				day("2026-10-08", 4, 5),
				day("2026-10-09", 2, 2),
				// 2026-10-10: nothing possible, skipped
				day("2026-10-11", 3, 3),
			],
			today,
			year: 2026,
		});
		expect(stats.current_streak).toBe(3);
		expect(stats.longest_streak).toBe(3);
	});

	it("keeps the current streak while today is still open", () => {
		const stats = overviewStats({
			days: [
				day("2026-10-10", 1, 1),
				day("2026-10-11", 1, 1),
				day(today, 0, 2),
			],
			today,
			year: 2026,
		});
		expect(stats.current_streak).toBe(2);
	});

	it("breaks the current streak on a past day below 80%", () => {
		const stats = overviewStats({
			days: [
				day("2026-10-01", 1, 1),
				day("2026-10-02", 1, 1),
				day("2026-10-03", 1, 1),
				day("2026-10-11", 3, 4),
			],
			today,
			year: 2026,
		});
		expect(stats.current_streak).toBe(0);
		expect(stats.longest_streak).toBe(3);
	});

	it("continues the current streak across the year boundary", () => {
		const stats = overviewStats({
			days: [
				day("2025-12-30", 1, 1),
				day("2025-12-31", 1, 1),
				day("2026-01-01", 1, 1),
			],
			today: "2026-01-02",
			year: 2026,
		});
		expect(stats.current_streak).toBe(3);
		// The longest streak only looks inside the shown year.
		expect(stats.longest_streak).toBe(1);
	});

	it("takes the longest streak from the shown year", () => {
		const days = [
			day("2025-03-01", 1, 1),
			day("2025-03-02", 1, 1),
			day("2025-03-03", 1, 1),
			day("2025-03-04", 1, 1),
			day("2026-10-11", 1, 1),
		];
		expect(overviewStats({ days, today, year: 2025 }).longest_streak).toBe(4);
		expect(overviewStats({ days, today, year: 2026 }).longest_streak).toBe(1);
	});

	it("computes the week (Sunday to today) and the month to date", () => {
		const stats = overviewStats({
			days: [
				day("2026-09-30", 5, 5), // last month
				day("2026-10-01", 1, 4),
				day("2026-10-10", 1, 2), // Saturday: previous week
				day("2026-10-11", 2, 2),
				day(today, 1, 2),
			],
			today,
			year: 2026,
		});
		expect(stats.week).toEqual({ completed: 3, possible: 4, ratio: 0.75 });
		expect(stats.month).toEqual({ completed: 5, possible: 10, ratio: 0.5 });
	});

	it("includes last year's days in a week that crosses January 1", () => {
		const stats = overviewStats({
			days: [
				day("2025-12-28", 1, 1),
				day("2025-12-31", 0, 1),
				day("2026-01-02", 1, 2),
			],
			today: "2026-01-02",
			year: 2026,
		});
		expect(stats.week).toEqual({ completed: 2, possible: 4, ratio: 0.5 });
		expect(stats.month).toEqual({ completed: 1, possible: 2, ratio: 0.5 });
	});

	it("ignores duplicated days and handles no data", () => {
		const twice = [day("2026-10-11", 1, 1), day("2026-10-11", 1, 1)];
		expect(overviewStats({ days: twice, today, year: 2026 }).week).toEqual({
			completed: 1,
			possible: 1,
			ratio: 1,
		});
		expect(overviewStats({ days: [], today, year: 2026 })).toEqual({
			current_streak: 0,
			longest_streak: 0,
			week: { completed: 0, possible: 0, ratio: 0 },
			month: { completed: 0, possible: 0, ratio: 0 },
		});
	});
});

describe("overviewNeedsPreviousYear", () => {
	it("is true while this week started last year", () => {
		// Saturday 2026-01-03: the week started on Sunday 2025-12-28.
		expect(overviewNeedsPreviousYear([], "2026-01-03")).toBe(true);
		// Sunday 2026-01-04 starts a week inside the year.
		expect(
			overviewNeedsPreviousYear([day("2026-01-02", 0, 1)], "2026-01-04")
		).toBe(false);
	});

	it("is true while nothing this year broke the current streak", () => {
		const strong = [day("2026-01-05", 1, 1), day("2026-01-06", 2, 2)];
		expect(overviewNeedsPreviousYear(strong, "2026-01-07")).toBe(true);
		// Nothing possible this year yet: the streak may come from December.
		expect(overviewNeedsPreviousYear([], "2026-01-07")).toBe(true);
		// An open today never decides it.
		expect(
			overviewNeedsPreviousYear(
				[...strong, day("2026-01-07", 0, 3)],
				"2026-01-07"
			)
		).toBe(true);
	});

	it("is false once a past day this year was below 80%", () => {
		expect(
			overviewNeedsPreviousYear([day("2026-03-01", 1, 2)], "2026-10-12")
		).toBe(false);
	});
});
