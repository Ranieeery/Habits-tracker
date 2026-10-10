import type { SummaryDay } from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	diffInDays,
	firstDayOfYear,
	lastDayOfYear,
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
}

/**
 * Full-year heatmap grid in weeks starting on Sunday, from the week containing
 * January 1 to the week containing December 31. Rendering (rows or columns,
 * scrolling, hiding future days) is up to each client.
 */
export function buildYearGrid({
	year,
	today,
	summary = [],
}: BuildYearGridInput): YearGrid {
	const byDate = new Map(summary.map((day) => [day.date, day]));
	const first = startOfWeek(firstDayOfYear(year));
	const last = lastDayOfYear(year);
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
			return {
				date,
				in_year: date.startsWith(`${String(year).padStart(4, "0")}-`),
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
