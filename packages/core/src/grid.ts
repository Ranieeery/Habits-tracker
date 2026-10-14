import type { Habit, SummaryDay } from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	diffInDays,
	firstDayOfYear,
	lastDayOfYear,
	parseCalendarDate,
	startOfWeek,
} from "./dates.ts";
import {
	completionRatio,
	type HeatmapLevel,
	heatmapLevel,
} from "./progress.ts";

export type DayRelation = "past" | "today" | "future";

export interface GridCell {
	date: CalendarDate;
	/** False for the padding days of the first and last weeks. */
	in_year: boolean;
	/**
	 * Whether the cell is drawn: every day of the year (future ones beyond
	 * the preview stay inert placeholders), plus the preview days that fall
	 * in the next year. Without a preview, equal to `in_year`.
	 */
	shown: boolean;
	/**
	 * A future day inside the preview window (`isPreviewDate`, 2.14.0): drawn
	 * as a read-only cell that opens its day. Never carries counts.
	 */
	preview: boolean;
	relation: DayRelation;
	completed: number;
	possible: number;
	ratio: number;
	level: HeatmapLevel;
}

export interface GridWeek {
	/** The Sunday that starts the week. */
	start: CalendarDate;
	/** Sunday to Saturday. */
	days: GridCell[];
}

export interface YearGrid {
	year: number;
	weeks: GridWeek[];
	/** Index of the week containing `today`, or null if it is outside the grid. */
	today_week_index: number | null;
}

export interface BuildYearGridInput {
	year: number;
	/** The user's local date, from `todayIn(timeZone, nowMs)`. */
	today: CalendarDate;
	summary?: readonly SummaryDay[];
	/**
	 * Future days to add after today (2.14.0, `PREVIEW_DAYS` in the apps;
	 * default 0: no preview). Only for the year that holds `today`: those days
	 * are marked `preview`. The grid still covers the whole year; only when
	 * the preview goes past December 31 does it grow into the next year, up to
	 * the week of `today + previewDays`, where later days are not shown.
	 */
	previewDays?: number;
}

/**
 * Full-year heatmap grid in weeks starting on Sunday, from the week containing
 * January 1 to the week containing December 31 (or, when the preview crosses
 * New Year, the week containing its last day). Rendering (rows or columns,
 * scrolling) is up to each client. The counts come only from `summary`:
 * preview days are always 0 of 0.
 */
export function buildYearGrid({
	year,
	today,
	summary = [],
	previewDays = 0,
}: BuildYearGridInput): YearGrid {
	const byDate = new Map(summary.map((day) => [day.date, day]));
	const yearPrefix = `${String(year).padStart(4, "0")}-`;
	const previewTo =
		previewDays > 0 && today.startsWith(yearPrefix)
			? addDays(today, previewDays)
			: null;
	const first = startOfWeek(firstDayOfYear(year));
	const yearEnd = lastDayOfYear(year);
	const last = previewTo !== null && previewTo > yearEnd ? previewTo : yearEnd;
	const weekCount = Math.floor(diffInDays(first, last) / 7) + 1;

	let todayWeekIndex: number | null = null;
	const weeks = Array.from({ length: weekCount }, (_, weekIndex): GridWeek => {
		const start = addDays(first, weekIndex * 7);
		const days = Array.from({ length: 7 }, (_, dayIndex): GridCell => {
			const date = addDays(start, dayIndex);
			const day = byDate.get(date);
			const completed = day?.completed ?? 0;
			const possible = day?.possible ?? 0;
			const ratio = completionRatio(completed, possible);
			if (date === today) todayWeekIndex = weekIndex;
			const inYear = date.startsWith(yearPrefix);
			const preview = previewTo !== null && date > today && date <= previewTo;
			return {
				date,
				in_year: inYear,
				shown: inYear || preview,
				preview,
				relation: date < today ? "past" : date === today ? "today" : "future",
				completed,
				possible,
				ratio,
				level: heatmapLevel(ratio),
			};
		});
		return { start, days };
	});

	return { year, weeks, today_week_index: todayWeekIndex };
}

export interface MonthLabel {
	/** 1-12. */
	month: number;
	/** The week column that holds the 1st of the month. */
	week_index: number;
}

/**
 * Where each month of the grid starts, in week columns: the months of its
 * year, plus January of the next year when the preview reaches it.
 */
export function monthLabels(grid: YearGrid): MonthLabel[] {
	const labels: MonthLabel[] = [];
	grid.weeks.forEach((week, weekIndex) => {
		for (const cell of week.days) {
			if (cell.shown && cell.date.endsWith("-01")) {
				labels.push({
					month: parseCalendarDate(cell.date).month,
					week_index: weekIndex,
				});
			}
		}
	});
	return labels;
}

export interface YearRange {
	/** Earliest year with something to show. */
	first: number;
	/** The current year (no navigating into the future). */
	last: number;
}

/**
 * The years the heatmap can show: from the year the oldest live habit
 * (archived included) started, up to the year of `today`. Without habits,
 * only the current year.
 */
export function heatmapYearRange(
	habits: readonly Pick<Habit, "start_date" | "deleted_at">[],
	today: CalendarDate
): YearRange {
	const last = parseCalendarDate(today).year;
	let first = last;
	for (const habit of habits) {
		if (habit.deleted_at !== null) continue;
		first = Math.min(first, parseCalendarDate(habit.start_date).year);
	}
	return { first, last };
}

/** `year` limited to `range` (a year that no longer has data is not kept). */
export function clampYear(year: number, { first, last }: YearRange): number {
	return Math.min(last, Math.max(first, year));
}
