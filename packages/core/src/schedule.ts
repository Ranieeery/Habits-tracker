import {
	type Habit,
	isSupportedSchedule,
	type StoredSchedule,
} from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	daysInMonth,
	diffInDays,
	isLeapYear,
	localDateAt,
	parseCalendarDate,
	weekdayOf,
} from "./dates.ts";
import { BACKFILL_DAYS } from "./window.ts";

/** The habit fields schedule evaluation needs (API rows and local DB rows). */
export type SchedulableHabit = Pick<
	Habit,
	"schedule" | "start_date" | "archived_at" | "deleted_at"
>;

export interface TimeZoneOptions {
	/** IANA time zone of the user, used to turn instants into local dates. */
	timeZone: string;
}

/**
 * Whether the schedule recurs on `date`, ignoring start and archive dates. A
 * schedule this build does not understand never matches.
 *
 * - `monthly_days`: a day the month does not have falls on its last day.
 * - `yearly`: February 29 falls on February 28 in years that are not leap.
 */
export function matchesSchedule(
	schedule: StoredSchedule,
	date: CalendarDate
): boolean {
	if (!isSupportedSchedule(schedule)) return false;
	switch (schedule.type) {
		case "weekdays":
			return schedule.days.includes(weekdayOf(date));
		case "interval": {
			const elapsed = diffInDays(schedule.anchor_date, date);
			return elapsed >= 0 && elapsed % schedule.every === 0;
		}
		case "monthly_days": {
			const { year, month, day } = parseCalendarDate(date);
			const last = daysInMonth(year, month);
			return schedule.days.some((wanted) => Math.min(wanted, last) === day);
		}
		case "once":
			return schedule.date === date;
		case "yearly": {
			const { year, month, day } = parseCalendarDate(date);
			if (month !== schedule.month) return false;
			const wanted =
				schedule.month === 2 && schedule.day === 29 && !isLeapYear(year)
					? 28
					: schedule.day;
			return day === wanted;
		}
		default: {
			const unknown: never = schedule;
			throw new Error(`Unknown schedule type: ${String(unknown)}`);
		}
	}
}

/**
 * Whether the habit counts on `date`: not deleted, started on or before it,
 * not archived before it, and scheduled for it. A habit archived during day D
 * still counts on D (it was not archived before D started).
 */
export function isHabitPossibleOn(
	habit: SchedulableHabit,
	date: CalendarDate,
	{ timeZone }: TimeZoneOptions
): boolean {
	if (habit.deleted_at !== null) return false;
	if (date < habit.start_date) return false;
	if (
		habit.archived_at !== null &&
		date > localDateAt(habit.archived_at, timeZone)
	) {
		return false;
	}
	return matchesSchedule(habit.schedule, date);
}

/**
 * Whether a habit counts on `date` for progress (heatmap, day view, streaks):
 * possible that day, or completed that day even if its schedule no longer
 * includes it (the schedule was edited, or a completion was synced for a day
 * the habit does not repeat on). A completion is never lost from the heatmap
 * and the ratio never passes 100%. Deleted habits never count.
 */
export function isHabitCountedOn(
	habit: SchedulableHabit,
	date: CalendarDate,
	completed: boolean,
	options: TimeZoneOptions
): boolean {
	if (habit.deleted_at !== null) return false;
	return completed || isHabitPossibleOn(habit, date, options);
}

/** Days `nextOccurrence` looks ahead (every schedule repeats within a year). */
export const MAX_LOOKAHEAD_DAYS = 400;

/** Longest range `occurrencesBetween` accepts, in days. */
export const MAX_OCCURRENCE_RANGE_DAYS = 366;

/**
 * The first date on or after `from` the habit is possible, or null when there
 * is none within `MAX_LOOKAHEAD_DAYS` (a past single date, an archived or
 * deleted habit, an unsupported schedule).
 */
export function nextOccurrence(
	habit: SchedulableHabit,
	from: CalendarDate,
	options: TimeZoneOptions
): CalendarDate | null {
	if (habit.deleted_at !== null || !isSupportedSchedule(habit.schedule)) {
		return null;
	}
	const start = from < habit.start_date ? habit.start_date : from;
	if (diffInDays(from, start) > MAX_LOOKAHEAD_DAYS) return null;
	for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
		const date = addDays(start, offset);
		if (isHabitPossibleOn(habit, date, options)) return date;
	}
	return null;
}

/**
 * Every date in `[from, to]` the habit is possible. The range is limited to
 * `MAX_OCCURRENCE_RANGE_DAYS` (RangeError otherwise).
 */
export function occurrencesBetween(
	habit: SchedulableHabit,
	from: CalendarDate,
	to: CalendarDate,
	options: TimeZoneOptions
): CalendarDate[] {
	const span = diffInDays(from, to);
	if (span > MAX_OCCURRENCE_RANGE_DAYS) {
		throw new RangeError(
			`Range longer than ${MAX_OCCURRENCE_RANGE_DAYS} days: ${from}..${to}`
		);
	}
	const dates: CalendarDate[] = [];
	for (let offset = 0; offset <= span; offset++) {
		const date = addDays(from, offset);
		if (isHabitPossibleOn(habit, date, options)) dates.push(date);
	}
	return dates;
}

/** Why the dates of a new or edited habit are refused. */
export type HabitDatesProblem =
	/** `start_date` (or a single date) before the earliest allowed date. */
	| "date_out_of_range"
	/** A single date before the habit's start: it would never happen. */
	| "date_before_start";

/**
 * The earliest `start_date` a new habit may have. Weekday habits keep the
 * backfill window (as before 2.2.0); the other schedules start today or
 * later, except for offline creations synced later (`offline`), which get
 * the same backfill window so a habit created yesterday for "today" is not
 * refused.
 */
export function earliestStartDate(
	schedule: StoredSchedule,
	today: CalendarDate,
	{ offline = false }: { offline?: boolean } = {}
): CalendarDate {
	if (offline || schedule.type === "weekdays") {
		return addDays(today, -BACKFILL_DAYS);
	}
	return today;
}

/**
 * Checks the dates of a habit against `earliest` (from `earliestStartDate`):
 * `start_date` (on creation) and a single date (creation and edits).
 */
export function checkHabitDates(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	earliest: CalendarDate,
	{ checkStart = true }: { checkStart?: boolean } = {}
): HabitDatesProblem | null {
	if (checkStart && habit.start_date < earliest) return "date_out_of_range";
	if (isSupportedSchedule(habit.schedule) && habit.schedule.type === "once") {
		if (habit.schedule.date < earliest) return "date_out_of_range";
		if (habit.schedule.date < habit.start_date) return "date_before_start";
	}
	return null;
}
