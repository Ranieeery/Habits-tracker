import type { Habit, Schedule } from "@habits/contracts";
import { type CalendarDate, localDateAt, weekdayOf } from "./dates.ts";

/** The habit fields schedule evaluation needs (API rows and local DB rows). */
export type SchedulableHabit = Pick<
	Habit,
	"schedule" | "start_date" | "archived_at" | "deleted_at"
>;

export interface TimeZoneOptions {
	/** IANA time zone of the user, used to turn instants into local dates. */
	timeZone: string;
}

/** Whether the schedule recurs on `date`, ignoring start and archive dates. */
export function matchesSchedule(
	schedule: Schedule,
	date: CalendarDate
): boolean {
	switch (schedule.type) {
		case "weekdays":
			return schedule.days.includes(weekdayOf(date));
		default: {
			const unknown: never = schedule.type;
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
