// pt-BR display formatting only. Date math, schedules and ratios come from
// @habits/core; dayjs here just turns a `YYYY-MM-DD` into words.
import type { CalendarDate } from "@habits/contracts";
import { addDays, formatCalendarDate } from "@habits/core";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

// dayjs parses a date-only string as local midnight, so the calendar date is
// kept as is regardless of the device time zone.
const fmt = (date: CalendarDate, template: string) =>
	dayjs(date).format(template);

/**
 * Only the first letter upper-cased (DESIGN.md: "Segunda-feira, 12 de
 * outubro", never "Segunda-Feira, 12 De Outubro" as `capitalize` does).
 */
export function capitalizeFirst(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "sexta-feira, 9 de outubro" */
export function formatLongDate(date: CalendarDate): string {
	return fmt(date, "dddd, D [de] MMMM");
}

/** "qui, 8 de out" (the heatmap's day preview, 2.10.0) */
export function formatCompactDate(date: CalendarDate): string {
	return fmt(date, "ddd, D [de] MMM");
}

/** "9 de outubro" */
export function formatDayMonth(date: CalendarDate): string {
	return fmt(date, "D [de] MMMM");
}

/** "9 de outubro de 2026" */
export function formatFullDate(date: CalendarDate): string {
	return fmt(date, "D [de] MMMM [de] YYYY");
}

/** "09/10" */
export function formatShortDate(date: CalendarDate): string {
	return fmt(date, "DD/MM");
}

// 2023-01-01 was a Sunday: offsetting it gives each weekday's name.
const SUNDAY = "2023-01-01";

/** "domingo" ... "sábado" (Sunday = 0). */
export function weekdayName(weekday: number): string {
	return fmt(addDays(SUNDAY, weekday), "dddd");
}

/** "D", "S", "T", "Q", "Q", "S", "S" (Sunday = 0). */
export function weekdayInitial(weekday: number): string {
	return weekdayName(weekday).charAt(0).toUpperCase();
}

/** "jan" ... "dez" (month 1-12). */
export function monthShortName(month: number): string {
	return fmt(formatCalendarDate({ year: 2023, month, day: 1 }), "MMM");
}

/** 0.6 → "60%" */
export function formatPercent(ratio: number): string {
	return `${Math.round(ratio * 100)}%`;
}

/** "1 hábito", "3 hábitos" */
export function pluralHabits(count: number): string {
	return `${count} ${count === 1 ? "hábito" : "hábitos"}`;
}
