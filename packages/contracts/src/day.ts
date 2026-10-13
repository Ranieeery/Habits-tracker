import { z } from "zod";
import { Habit } from "./habit.ts";
import { CalendarDate, Uuid } from "./primitives.ts";

export const DayQuery = z.object({ date: CalendarDate });
export type DayQuery = z.infer<typeof DayQuery>;

/**
 * A fixed-day habit (days of the month, single date, yearly) whose last
 * occurrence went by without a completion (2.8.0, core `overdueOn`). It shows
 * on today's list until it is completed or `OVERDUE_DAYS` pass.
 */
export const OverdueHabit = z.object({
	habit: Habit,
	/** The missed occurrence (the heatmap keeps the failure on this date). */
	since: CalendarDate,
	/**
	 * Completed today: kept in the list (checked) so unchecking brings it
	 * back as overdue.
	 */
	completed_today: z.boolean(),
});
export type OverdueHabit = z.infer<typeof OverdueHabit>;

/** Habits possible on a local date and which of them were completed. */
export const DayResponse = z.object({
	date: CalendarDate,
	possible_habits: z.array(Habit),
	completed_habit_ids: z.array(Uuid),
	/**
	 * Only for the user's today (2.8.0, additive): the overdue habits, in the
	 * user's order. Absent on other days and from older APIs.
	 */
	overdue: z.array(OverdueHabit).optional(),
});
export type DayResponse = z.infer<typeof DayResponse>;
