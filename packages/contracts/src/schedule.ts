import { z } from "zod";
import { CalendarDate, Weekday } from "./primitives.ts";

/** Longest `interval` repetition, in days. */
export const MAX_INTERVAL_DAYS = 366;

/** Days in each month (1-12) at most: February allows 29 (leap years). */
const MAX_DAY_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function unique(values: readonly number[]): boolean {
	return new Set(values).size === values.length;
}

/** Recurs on the given weekdays. */
export const WeekdaysSchedule = z.object({
	type: z.literal("weekdays"),
	days: z
		.array(Weekday)
		.min(1)
		.max(7)
		.refine(unique, { message: "Weekdays must be unique" }),
});
export type WeekdaysSchedule = z.infer<typeof WeekdaysSchedule>;

/** Every `every` days, starting on `anchor_date` (the first occurrence). */
export const IntervalSchedule = z.object({
	type: z.literal("interval"),
	every: z.int().min(1).max(MAX_INTERVAL_DAYS),
	anchor_date: CalendarDate,
});
export type IntervalSchedule = z.infer<typeof IntervalSchedule>;

/**
 * On the given days of every month (1-31). A day the month does not have
 * falls on the month's last day (31 in April is the 30th, 30 in February the
 * 28th or 29th).
 */
export const MonthlyDaysSchedule = z.object({
	type: z.literal("monthly_days"),
	days: z
		.array(z.int().min(1).max(31))
		.min(1)
		.max(31)
		.refine(unique, { message: "Days must be unique" }),
});
export type MonthlyDaysSchedule = z.infer<typeof MonthlyDaysSchedule>;

/** A single local date. */
export const OnceSchedule = z.object({
	type: z.literal("once"),
	date: CalendarDate,
});
export type OnceSchedule = z.infer<typeof OnceSchedule>;

/**
 * Every year on `month`/`day`. February 29 falls on February 28 in years
 * that are not leap years.
 */
export const YearlySchedule = z
	.object({
		type: z.literal("yearly"),
		month: z.int().min(1).max(12),
		day: z.int().min(1).max(31),
	})
	.refine(({ month, day }) => day <= (MAX_DAY_IN_MONTH[month - 1] ?? 0), {
		message: "Day does not exist in that month",
		path: ["day"],
	});
export type YearlySchedule = z.infer<typeof YearlySchedule>;

/**
 * A task that can be done any day until `due_date` (2.13.0). Single deadline
 * for now; a later recurrence would add optional fields under a new
 * `SCHEDULE_TYPE_VERSION` without any data migration.
 */
export const DeadlineSchedule = z.object({
	type: z.literal("deadline"),
	due_date: CalendarDate,
});
export type DeadlineSchedule = z.infer<typeof DeadlineSchedule>;

/**
 * When a habit recurs (what clients may write). New frequencies are added as
 * new union members with a version in `SCHEDULE_TYPE_VERSION`; no data
 * migration is needed (the database only requires a JSON object with a
 * string `type`).
 */
export const Schedule = z.discriminatedUnion("type", [
	WeekdaysSchedule,
	IntervalSchedule,
	MonthlyDaysSchedule,
	OnceSchedule,
	YearlySchedule,
	DeadlineSchedule,
]);
export type Schedule = z.infer<typeof Schedule>;
export type ScheduleType = Schedule["type"];

/**
 * The schedule version that introduced each type. A client announces the
 * highest version it understands (`SCHEDULE_VERSION_HEADER`); the API leaves
 * out habits of newer types for it. Clients without the header are version 1
 * (the 2.1.0 apps).
 */
export const SCHEDULE_TYPE_VERSION: Readonly<Record<ScheduleType, number>> = {
	weekdays: 1,
	interval: 2,
	monthly_days: 2,
	once: 2,
	yearly: 2,
	deadline: 3,
};

/** The highest schedule version this build understands. */
export const SCHEDULE_VERSION = 3;

/** Request header carrying the client's `SCHEDULE_VERSION`. */
export const SCHEDULE_VERSION_HEADER = "X-Habits-Schedule-Version";

/**
 * A schedule this build does not understand (a type from a newer version, or
 * a malformed known one). Reads keep it so a newer habit never breaks a
 * screen: it is never possible on any day and shows as incompatible.
 */
export type UnsupportedSchedule = { type: string };
// Parsed loosely (other fields are kept as stored), but typed as `{ type }`
// only: an index signature of `unknown` becomes `never` in Hono RPC
// response types and would break the clients' types.
export const UnsupportedSchedule: z.ZodType<UnsupportedSchedule> =
	z.looseObject({ type: z.string() });

/** A schedule as read from storage or the API: known, or kept as is. */
export const StoredSchedule = z.union([Schedule, UnsupportedSchedule]);
export type StoredSchedule = z.infer<typeof StoredSchedule>;

// Year views evaluate each habit's schedule once per day: parse each schedule
// object once. Records are never mutated in place, so caching by identity is
// safe.
const supported = new WeakMap<object, boolean>();

/** Narrows a stored schedule to one this build understands. */
export function isSupportedSchedule(
	schedule: StoredSchedule
): schedule is Schedule {
	let result = supported.get(schedule);
	if (result === undefined) {
		result = Schedule.safeParse(schedule).success;
		supported.set(schedule, result);
	}
	return result;
}

/** The schedule version a schedule needs (unknown types: above any client). */
export function scheduleVersionOf(schedule: StoredSchedule): number {
	return isSupportedSchedule(schedule)
		? SCHEDULE_TYPE_VERSION[schedule.type]
		: Number.POSITIVE_INFINITY;
}
