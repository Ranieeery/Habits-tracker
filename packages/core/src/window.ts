import { addDays, type CalendarDate, localDateAt } from "./dates.ts";

/**
 * How many days back a completion may be written: the past days a client can
 * edit (after a confirmation, since 2.3.0) and how old a queued offline change
 * may be when it syncs. The server, both clients and the sync rules share it.
 */
export const BACKFILL_DAYS = 30;

/**
 * The user's local "today". `nowMs` is passed in by the caller (the only place
 * that reads the clock), so this stays pure and testable.
 */
export function todayIn(timeZone: string, nowMs: number): CalendarDate {
	return localDateAt(nowMs, timeZone);
}

export interface DateWindow {
	from: CalendarDate;
	to: CalendarDate;
}

/**
 * Dates the server accepts writes for: `[today - BACKFILL_DAYS, today + 1]`.
 * The extra day ahead covers clients whose clock is just past midnight.
 */
export function writeWindow(today: CalendarDate): DateWindow {
	return { from: addDays(today, -BACKFILL_DAYS), to: addDays(today, 1) };
}

export function isWithinWriteWindow(
	date: CalendarDate,
	today: CalendarDate
): boolean {
	const { from, to } = writeWindow(today);
	return date >= from && date <= to;
}
