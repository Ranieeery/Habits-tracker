// Month calendars for the date pickers of both clients (no native picker:
// browsers show <input type="date"> in their own locale, e.g. mm/dd/yyyy).
import {
	type CalendarDate,
	daysInMonth,
	formatCalendarDate,
	parseCalendarDate,
	weekdayOf,
} from "./dates.ts";
import { MONTH_NAMES } from "./habit-draft.ts";

export interface MonthRef {
	year: number;
	/** 1-12 */
	month: number;
}

export function monthOf(date: CalendarDate): MonthRef {
	const { year, month } = parseCalendarDate(date);
	return { year, month };
}

export function addMonths({ year, month }: MonthRef, delta: number): MonthRef {
	const index = year * 12 + (month - 1) + delta;
	return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "outubro de 2026". */
export function monthTitle({ year, month }: MonthRef): string {
	return `${MONTH_NAMES[month - 1]} de ${year}`;
}

/**
 * The month as weeks of 7 cells, Sunday first; cells outside the month are
 * null.
 */
export function monthGrid({
	year,
	month,
}: MonthRef): (CalendarDate | null)[][] {
	const first = formatCalendarDate({ year, month, day: 1 });
	const cells: (CalendarDate | null)[] = Array.from(
		{ length: weekdayOf(first) },
		() => null
	);
	for (let day = 1; day <= daysInMonth(year, month); day++) {
		cells.push(formatCalendarDate({ year, month, day }));
	}
	while (cells.length % 7 !== 0) cells.push(null);
	const weeks: (CalendarDate | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

/** Whether `target` is a month entirely before `min`. */
export function isMonthBefore(target: MonthRef, min: CalendarDate): boolean {
	const limit = monthOf(min);
	return target.year * 12 + target.month < limit.year * 12 + limit.month;
}
