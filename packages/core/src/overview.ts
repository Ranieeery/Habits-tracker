import type { SummaryDay } from "@habits/contracts";
import {
	type CalendarDate,
	eachDay,
	firstDayOfYear,
	formatCalendarDate,
	lastDayOfYear,
	parseCalendarDate,
	startOfWeek,
} from "./dates.ts";
import { completionRatio, heatmapLevel } from "./progress.ts";
import { computeStreaks, type Streaks } from "./streaks.ts";

type DayCounts = Pick<SummaryDay, "completed" | "possible">;

/**
 * A "strong" day reached the top heatmap level (80% or more of what was
 * possible). Days with nothing possible are never strong; streaks skip them.
 */
export function isStrongDay(day: DayCounts): boolean {
	return (
		day.possible > 0 &&
		heatmapLevel(completionRatio(day.completed, day.possible)) === 5
	);
}

export interface PeriodProgress {
	completed: number;
	possible: number;
	/** `completed / possible` in [0, 1]; 0 when nothing was possible. */
	ratio: number;
}

/** Completed over possible habits summed over `from`..`to` (inclusive). */
export function periodProgress(
	days: readonly SummaryDay[],
	from: CalendarDate,
	to: CalendarDate
): PeriodProgress {
	let completed = 0;
	let possible = 0;
	for (const day of days) {
		if (day.date < from || day.date > to) continue;
		completed += day.completed;
		possible += day.possible;
	}
	return { completed, possible, ratio: completionRatio(completed, possible) };
}

function byDate(days: readonly SummaryDay[]): Map<CalendarDate, SummaryDay> {
	return new Map(days.map((day) => [day.date, day]));
}

function strongStreaks(
	days: ReadonlyMap<CalendarDate, SummaryDay>,
	from: CalendarDate,
	today: CalendarDate
): Streaks {
	if (from > today) return { current: 0, longest: 0 };
	return computeStreaks({
		from,
		today,
		isPossible: (date) => (days.get(date)?.possible ?? 0) > 0,
		isDone: (date) => {
			const day = days.get(date);
			return day !== undefined && isStrongDay(day);
		},
	});
}

function earliest(days: Iterable<CalendarDate>): CalendarDate | null {
	let min: CalendarDate | null = null;
	for (const date of days) if (min === null || date < min) min = date;
	return min;
}

export interface OverviewStats {
	/** Strong days in a row ending today (an open today does not break it). */
	current_streak: number;
	/** Longest run of strong days inside `year`, up to today. */
	longest_streak: number;
	/** Sunday of this week up to today. */
	week: PeriodProgress;
	/** The 1st of this month up to today. */
	month: PeriodProgress;
}

export interface OverviewStatsInput {
	/**
	 * Summary days of the shown year and of today's year (plus the previous
	 * year when `overviewNeedsPreviousYear` says so). Duplicates are fine.
	 */
	days: readonly SummaryDay[];
	/** The user's local date, from `todayIn(timeZone, nowMs)`. */
	today: CalendarDate;
	/** The year shown in the heatmap: only `longest_streak` depends on it. */
	year: number;
}

/**
 * The numbers above the heatmap. The current streak, the week and the month
 * are always about today; the longest streak follows the shown year. A
 * current streak only counts the days it was given, so it stops at the
 * earliest summary day passed in.
 */
export function overviewStats({
	days,
	today,
	year,
}: OverviewStatsInput): OverviewStats {
	const map = byDate(days);
	const unique = [...map.values()];
	const from = earliest(map.keys());
	const yearEnd = lastDayOfYear(year);
	const { year: thisYear, month } = parseCalendarDate(today);

	return {
		current_streak: from === null ? 0 : strongStreaks(map, from, today).current,
		longest_streak: strongStreaks(
			map,
			firstDayOfYear(year),
			yearEnd < today ? yearEnd : today
		).longest,
		week: periodProgress(unique, startOfWeek(today), today),
		month: periodProgress(
			unique,
			formatCalendarDate({ year: thisYear, month, day: 1 }),
			today
		),
	};
}

/**
 * Whether `overviewStats` also needs the previous year's summary, given the
 * summary of today's year: this week started last year, or nothing this year
 * has broken the current streak yet (so it may continue from December).
 */
export function overviewNeedsPreviousYear(
	currentYearDays: readonly SummaryDay[],
	today: CalendarDate
): boolean {
	const jan1 = firstDayOfYear(parseCalendarDate(today).year);
	if (startOfWeek(today) < jan1) return true;
	const map = byDate(currentYearDays);
	for (const date of eachDay(jan1, today)) {
		const day = map.get(date);
		if (!day || day.possible === 0 || date === today) continue;
		if (!isStrongDay(day)) return false;
	}
	return true;
}
