import { isSupportedSchedule, type StoredSchedule } from "@habits/contracts";
import {
	type CalendarDate,
	daysInMonth,
	diffInDays,
	isLeapYear,
	parseCalendarDate,
	weekdayOf,
} from "./dates.ts";

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
		// The due date is the deadline's only "occurrence" (when it counts as a
		// failure if still open; `countOn`).
		case "deadline":
			return schedule.due_date === date;
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
