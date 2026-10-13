// The Hoje tab's strip of the last days (2.6.0). Dates, ratios and levels
// come from @habits/core; this only picks the days and words them.
import type { CalendarDate, SummaryDay } from "@habits/contracts";
import {
	addDays,
	completionRatio,
	type HeatmapLevel,
	heatmapLevel,
	parseCalendarDate,
	weekdayOf,
} from "@habits/core";
import { formatDayMonth, formatPercent, weekdayName } from "@/lib/format.ts";

/** Today and the six days before it: all inside the 30-day edit window. */
export const STRIP_DAYS = 7;

export interface StripDay {
	date: CalendarDate;
	/** "S" */
	initial: string;
	/** "12" */
	dayOfMonth: string;
	level: HeatmapLevel;
	isToday: boolean;
	/** "segunda-feira, 12 de outubro (hoje): 2 de 3 hábitos (67%)" */
	label: string;
}

/** The strip's first day. */
export function stripStart(today: CalendarDate): CalendarDate {
	return addDays(today, -(STRIP_DAYS - 1));
}

/** Whether the strip reaches into last year (its summary is needed too). */
export function stripNeedsPreviousYear(today: CalendarDate): boolean {
	return (
		parseCalendarDate(stripStart(today)).year < parseCalendarDate(today).year
	);
}

/** The strip's days, oldest first, from the year summaries loaded so far. */
export function stripDays(
	today: CalendarDate,
	summaries: readonly SummaryDay[]
): StripDay[] {
	const byDate = new Map(summaries.map((day) => [day.date, day]));
	return Array.from({ length: STRIP_DAYS }, (_, index) => {
		const date = addDays(stripStart(today), index);
		const summary = byDate.get(date);
		const completed = summary?.completed ?? 0;
		const possible = summary?.possible ?? 0;
		const ratio = completionRatio(completed, possible);
		const name = weekdayName(weekdayOf(date));
		const isToday = date === today;
		const status =
			possible === 0
				? "nenhum hábito previsto"
				: `${completed} de ${possible} hábitos (${formatPercent(ratio)})`;
		return {
			date,
			initial: name.charAt(0).toUpperCase(),
			dayOfMonth: String(parseCalendarDate(date).day),
			level: heatmapLevel(ratio),
			isToday,
			label: `${name}, ${formatDayMonth(date)}${isToday ? " (hoje)" : ""}: ${status}`,
		};
	});
}
