// Calendar dates are local `YYYY-MM-DD` strings. Arithmetic on them is pure
// integer math on "epoch days" (days since 1970-01-01), so it never depends on
// the runtime's time zone. The only conversion from an instant is
// `localDateAt`, which always takes the IANA time zone explicitly.

import type { CalendarDate } from "@habits/contracts";

export type { CalendarDate };

/** Sunday = 0 ... Saturday = 6. */
export type WeekdayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DateParts {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function daysInYear(year: number): number {
	return isLeapYear(year) ? 366 : 365;
}

/** Parses `YYYY-MM-DD`, or returns null if it is not a real calendar date. */
export function tryParseCalendarDate(value: string): DateParts | null {
	const match = DATE_PATTERN.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > daysInMonth(year, month)) return null;
	return { year, month, day };
}

export function isCalendarDate(value: string): value is CalendarDate {
	return tryParseCalendarDate(value) !== null;
}

export function parseCalendarDate(value: string): DateParts {
	const parts = tryParseCalendarDate(value);
	if (!parts) throw new RangeError(`Invalid calendar date: ${value}`);
	return parts;
}

export function formatCalendarDate({
	year,
	month,
	day,
}: DateParts): CalendarDate {
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Howard Hinnant's days_from_civil / civil_from_days algorithms.
function toEpochDay({ year, month, day }: DateParts): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const mp = (month + 9) % 12;
	const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

function fromEpochDay(epochDay: number): DateParts {
	const z = epochDay + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe -
			Math.floor(doe / 1460) +
			Math.floor(doe / 36524) -
			Math.floor(doe / 146096)) /
			365
	);
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const month = mp < 10 ? mp + 3 : mp - 9;
	return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

export function epochDayOf(date: CalendarDate): number {
	return toEpochDay(parseCalendarDate(date));
}

export function dateFromEpochDay(epochDay: number): CalendarDate {
	return formatCalendarDate(fromEpochDay(epochDay));
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
	return dateFromEpochDay(epochDayOf(date) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffInDays(from: CalendarDate, to: CalendarDate): number {
	return epochDayOf(to) - epochDayOf(from);
}

/** Negative, zero or positive, like `Array#sort` comparators. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
	// Valid `YYYY-MM-DD` strings sort lexicographically in date order.
	return a < b ? -1 : a > b ? 1 : 0;
}

export function weekdayOf(date: CalendarDate): WeekdayNumber {
	// 1970-01-01 was a Thursday (4).
	return ((((epochDayOf(date) + 4) % 7) + 7) % 7) as WeekdayNumber;
}

/** The Sunday on or before `date`. */
export function startOfWeek(date: CalendarDate): CalendarDate {
	return addDays(date, -weekdayOf(date));
}

export function firstDayOfYear(year: number): CalendarDate {
	return formatCalendarDate({ year, month: 1, day: 1 });
}

export function lastDayOfYear(year: number): CalendarDate {
	return formatCalendarDate({ year, month: 12, day: 31 });
}

/** Every date from `from` to `to`, both inclusive. Empty if `to < from`. */
export function eachDay(from: CalendarDate, to: CalendarDate): CalendarDate[] {
	const start = epochDayOf(from);
	const length = epochDayOf(to) - start + 1;
	return Array.from({ length: Math.max(0, length) }, (_, i) =>
		dateFromEpochDay(start + i)
	);
}

export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

/** The local calendar date of a UTC instant (ms) in an IANA time zone. */
export function localDateAt(instantMs: number, timeZone: string): CalendarDate {
	const parts = formatterFor(timeZone).formatToParts(instantMs);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	return formatCalendarDate({
		year: get("year"),
		month: get("month"),
		day: get("day"),
	});
}
