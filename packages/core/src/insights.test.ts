import type { SummaryDay } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { clampDayToMonth, daysInAnyYear } from "./calendar.ts";
import { addDays, eachDay } from "./dates.ts";
import {
	MIN_MONTH_SAMPLE,
	MIN_WEEKDAY_SAMPLE,
	recentDays,
	trendChange,
	trendNeedsPreviousYear,
	weeklyTrend,
	yearHighlights,
} from "./insights.ts";

/** One habit possible every day from `from` to `to`, done when `done(date)`. */
function daily(
	from: string,
	to: string,
	done: (date: string) => boolean
): SummaryDay[] {
	return eachDay(from, to).map((date) => ({
		date,
		possible: 1,
		completed: done(date) ? 1 : 0,
	}));
}

describe("weeklyTrend", () => {
	it("gives the last weeks Sunday to Saturday, the current one up to today", () => {
		// 2026-10-12 is a Monday; its week starts on Sunday 10-11.
		const days = daily("2026-08-01", "2026-10-12", () => true);
		const trend = weeklyTrend(days, "2026-10-12", 3);
		expect(
			trend.map(({ start, end, current }) => [start, end, current])
		).toEqual([
			["2026-09-27", "2026-10-03", false],
			["2026-10-04", "2026-10-10", false],
			["2026-10-11", "2026-10-12", true],
		]);
		expect(trend.map((week) => week.possible)).toEqual([7, 7, 2]);
		expect(trend.every((week) => week.ratio === 1)).toBe(true);
	});

	it("reaches across New Year and leaves empty weeks at zero", () => {
		const days = daily("2026-01-01", "2026-01-06", () => true);
		const trend = weeklyTrend(days, "2026-01-06", 3);
		expect(trend[0]).toMatchObject({
			start: "2025-12-21",
			possible: 0,
			ratio: 0,
		});
		// The week of 2025-12-28 holds 2026-01-01..03 only.
		expect(trend[1]).toMatchObject({ start: "2025-12-28", possible: 3 });
		expect(trend[2]).toMatchObject({ start: "2026-01-04", possible: 3 });
	});
});

describe("trendChange", () => {
	it("compares the last 4 weeks with the 4 before them, in points", () => {
		const start = "2026-07-19";
		// Weeks 0-3: half done; weeks 4-7: all done.
		const days = daily(start, addDays(start, 55), (date) =>
			date >= addDays(start, 28) ? true : Number(date.slice(8)) % 2 === 0
		);
		const trend = weeklyTrend(days, addDays(start, 55), 8);
		const change = trendChange(trend);
		expect(change.recent.ratio).toBe(1);
		expect(change.previous?.ratio).toBeCloseTo(0.5, 1);
		expect(change.delta).toBe(Math.round((1 - change.previous!.ratio) * 100));
	});

	it("has no comparison when the earlier weeks had nothing possible", () => {
		const days = daily("2026-10-01", "2026-10-12", () => true);
		const change = trendChange(weeklyTrend(days, "2026-10-12", 12));
		expect(change.previous).toBeNull();
		expect(change.delta).toBeNull();
		expect(change.recent.ratio).toBe(1);
	});
});

describe("yearHighlights", () => {
	it("finds the best weekday and month and counts perfect days", () => {
		// Done only on Wednesdays (weekday 3) from January to October.
		const days = daily("2026-01-01", "2026-10-12", (date) => {
			const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
			return weekday === 3 || date.startsWith("2026-03");
		});
		const result = yearHighlights(days, "2026-10-12", 2026);
		expect(result.bestWeekday?.weekday).toBe(3);
		expect(result.bestMonth).toEqual({ month: 3, ratio: 1 });
		expect(result.perfectDays).toBeGreaterThan(31);
	});

	it("ignores small samples, other years and days after today", () => {
		const days: SummaryDay[] = [
			{ date: "2025-12-31", possible: 1, completed: 1 },
			{ date: "2026-01-01", possible: 1, completed: 1 },
			{ date: "2026-12-31", possible: 1, completed: 1 },
		];
		const result = yearHighlights(days, "2026-01-02", 2026);
		expect(result.bestWeekday).toBeNull();
		expect(result.bestMonth).toBeNull();
		expect(result.perfectDays).toBe(1);
		expect(MIN_WEEKDAY_SAMPLE).toBeGreaterThan(1);
		expect(MIN_MONTH_SAMPLE).toBeGreaterThan(MIN_WEEKDAY_SAMPLE);
	});

	it("has nothing to say about an empty year", () => {
		expect(yearHighlights([], "2026-10-12", 2026)).toEqual({
			bestWeekday: null,
			bestMonth: null,
			perfectDays: 0,
		});
	});
});

describe("month days of a yearly habit", () => {
	it("offers 29 in February and keeps or clamps the chosen day", () => {
		expect(daysInAnyYear(2)).toBe(29);
		expect(daysInAnyYear(4)).toBe(30);
		expect(clampDayToMonth(4, 31)).toBe(30);
		expect(clampDayToMonth(2, 30)).toBe(29);
		expect(clampDayToMonth(1, 15)).toBe(15);
		expect(clampDayToMonth(1, 0)).toBe(1);
	});
});

describe("trendNeedsPreviousYear", () => {
	it("is true only while the 12 weeks reach into last year", () => {
		expect(trendNeedsPreviousYear("2026-03-01")).toBe(true);
		expect(trendNeedsPreviousYear("2026-10-12")).toBe(false);
		expect(trendNeedsPreviousYear("2026-03-31", 4)).toBe(false);
	});
});

describe("recentDays", () => {
	it("marks the last days as done, missed or none, oldest first", () => {
		const days: SummaryDay[] = [
			{ date: "2026-10-10", possible: 1, completed: 1 },
			{ date: "2026-10-11", possible: 2, completed: 1 },
			{ date: "2026-10-12", possible: 0, completed: 0 },
		];
		expect(recentDays(days, "2026-10-12", 4)).toEqual([
			{ date: "2026-10-09", state: "none" },
			{ date: "2026-10-10", state: "done" },
			{ date: "2026-10-11", state: "missed" },
			{ date: "2026-10-12", state: "none" },
		]);
		expect(recentDays([], "2026-10-12")).toHaveLength(30);
	});
});
