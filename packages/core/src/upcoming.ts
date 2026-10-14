// "Próximos" on today's screen: the coming dates of habits that do not repeat
// by weekday (single dates, intervals, days of the month, yearly), computed
// on the client from the habits it already has.
import { type Habit, isSupportedSchedule } from "@habits/contracts";
import { addDays, type CalendarDate } from "./dates.ts";
import {
	occurrencesBetween,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";
import { compareHabitOrder } from "./sort-key.ts";

/** Days after today that "Próximos" covers. */
export const UPCOMING_DAYS = 14;

export interface UpcomingItem<H> {
	date: CalendarDate;
	habit: H;
}

export interface UpcomingOptions extends TimeZoneOptions {
	/** Days after `today` to include (default `UPCOMING_DAYS`). */
	days?: number;
}

/**
 * Occurrences from tomorrow to `today + days` of live, unarchived habits
 * whose schedule is not `weekdays`, by date, then in the user's order
 * (`compareHabitOrder`, as in every other list).
 */
export function upcoming<
	H extends SchedulableHabit &
		Pick<Habit, "id" | "name" | "sort_key" | "created_at">,
>(
	habits: readonly H[],
	today: CalendarDate,
	{ days = UPCOMING_DAYS, ...options }: UpcomingOptions
): UpcomingItem<H>[] {
	const from = addDays(today, 1);
	const to = addDays(today, days);
	const items: UpcomingItem<H>[] = [];
	for (const habit of habits) {
		if (habit.deleted_at !== null || habit.archived_at !== null) continue;
		if (!isSupportedSchedule(habit.schedule)) continue;
		// Deadline tasks show in "Com prazo" (2.13.0).
		if (
			habit.schedule.type === "weekdays" ||
			habit.schedule.type === "deadline"
		) {
			continue;
		}
		for (const date of occurrencesBetween(habit, from, to, options)) {
			items.push({ date, habit });
		}
	}
	return items.sort(
		(a, b) =>
			a.date.localeCompare(b.date) || compareHabitOrder(a.habit, b.habit)
	);
}
