// Numbers for the history screen beyond the overview (2.7.0): the weekly
// trend and the year's highlights. Pure functions over summary days (all
// habits, or one habit's summary for the per-habit filter), so every client
// reads the same answers.
import type { SummaryDay } from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	parseCalendarDate,
	startOfWeek,
	type WeekdayNumber,
	weekdayOf,
} from "./dates.ts";
import { type PeriodProgress, periodProgress } from "./overview.ts";
import { completionRatio } from "./progress.ts";

export interface WeekProgress extends PeriodProgress {
	/** The Sunday that starts the week. */
	start: CalendarDate;
	/** Saturday, or today for the current week. */
	end: CalendarDate;
	current: boolean;
}

/**
 * The last `weeks` weeks (Sunday to Saturday) up to today, oldest first; the
 * current week counts only up to today. Weeks with nothing possible have
 * ratio 0 and possible 0 (callers may show them as empty).
 */
export function weeklyTrend(
	days: readonly SummaryDay[],
	today: CalendarDate,
	weeks = 12
): WeekProgress[] {
	const thisWeek = startOfWeek(today);
	return Array.from({ length: weeks }, (_, index) => {
		const start = addDays(thisWeek, -7 * (weeks - 1 - index));
		const current = start === thisWeek;
		const end = current ? today : addDays(start, 6);
		return { start, end, current, ...periodProgress(days, start, end) };
	});
}

export interface TrendChange {
	/** The last `span` weeks together. */
	recent: PeriodProgress;
	/** The `span` weeks before them, or null when nothing was possible. */
	previous: PeriodProgress | null;
	/** `recent - previous` in percentage points, rounded; null without both. */
	delta: number | null;
}

function sum(weeks: readonly WeekProgress[]): PeriodProgress {
	const completed = weeks.reduce((total, week) => total + week.completed, 0);
	const possible = weeks.reduce((total, week) => total + week.possible, 0);
	return { completed, possible, ratio: completionRatio(completed, possible) };
}

/** The last `span` weeks of a trend against the `span` weeks before them. */
export function trendChange(
	trend: readonly WeekProgress[],
	span = 4
): TrendChange {
	const recent = sum(trend.slice(-span));
	const before = sum(trend.slice(-2 * span, -span));
	const previous = before.possible > 0 ? before : null;
	const delta =
		previous && recent.possible > 0
			? Math.round((recent.ratio - previous.ratio) * 100)
			: null;
	return { recent, previous, delta };
}

/**
 * Below these many possible habit-days a weekday or month is not "best": a
 * single good Tuesday should not win the year.
 */
export const MIN_WEEKDAY_SAMPLE = 8;
export const MIN_MONTH_SAMPLE = 15;

export interface YearHighlights {
	bestWeekday: { weekday: WeekdayNumber; ratio: number } | null;
	/** `month` is 1-12. */
	bestMonth: { month: number; ratio: number } | null;
	/** Days with every possible habit done. */
	perfectDays: number;
}

function best<K extends number>(
	groups: Map<K, { completed: number; possible: number }>,
	minSample: number
): { key: K; ratio: number } | null {
	let winner: { key: K; ratio: number; possible: number } | null = null;
	for (const [key, { completed, possible }] of groups) {
		if (possible < minSample) continue;
		const ratio = completionRatio(completed, possible);
		// Ties go to the larger sample, then to the earlier key.
		if (
			!winner ||
			ratio > winner.ratio ||
			(ratio === winner.ratio &&
				(possible > winner.possible ||
					(possible === winner.possible && key < winner.key)))
		) {
			winner = { key, ratio, possible };
		}
	}
	return winner ? { key: winner.key, ratio: winner.ratio } : null;
}

/** The year's highlights up to today (days after today are ignored). */
export function yearHighlights(
	days: readonly SummaryDay[],
	today: CalendarDate,
	year: number
): YearHighlights {
	const byWeekday = new Map<
		WeekdayNumber,
		{ completed: number; possible: number }
	>();
	const byMonth = new Map<number, { completed: number; possible: number }>();
	let perfectDays = 0;
	for (const day of days) {
		if (day.date > today || day.possible === 0) continue;
		const { year: dayYear, month } = parseCalendarDate(day.date);
		if (dayYear !== year) continue;
		if (day.completed >= day.possible) perfectDays += 1;
		const add = <K>(
			map: Map<K, { completed: number; possible: number }>,
			key: K
		) => {
			const group = map.get(key) ?? { completed: 0, possible: 0 };
			group.completed += day.completed;
			group.possible += day.possible;
			map.set(key, group);
		};
		add(byWeekday, weekdayOf(day.date));
		add(byMonth, month);
	}
	const weekday = best(byWeekday, MIN_WEEKDAY_SAMPLE);
	const month = best(byMonth, MIN_MONTH_SAMPLE);
	return {
		bestWeekday: weekday && { weekday: weekday.key, ratio: weekday.ratio },
		bestMonth: month && { month: month.key, ratio: month.ratio },
		perfectDays,
	};
}

/** Whether a trend of `weeks` weeks up to today starts in last year. */
export function trendNeedsPreviousYear(
	today: CalendarDate,
	weeks = 12
): boolean {
	const first = addDays(startOfWeek(today), -7 * (weeks - 1));
	return parseCalendarDate(first).year < parseCalendarDate(today).year;
}

export type RecentDayState = "done" | "missed" | "none";

/**
 * The last `count` days up to today, oldest first, for a small strip: done
 * (everything possible completed), missed (something possible not done) or
 * none (nothing possible, or no data for that day).
 */
export function recentDays(
	days: readonly SummaryDay[],
	today: CalendarDate,
	count = 30
): { date: CalendarDate; state: RecentDayState }[] {
	const byDate = new Map(days.map((day) => [day.date, day]));
	return Array.from({ length: count }, (_, index) => {
		const date = addDays(today, index - count + 1);
		const day = byDate.get(date);
		const state: RecentDayState =
			!day || day.possible === 0
				? "none"
				: day.completed >= day.possible
					? "done"
					: "missed";
		return { date, state };
	});
}
