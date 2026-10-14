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

/**
 * A task with a deadline still open on today (2.13.0, core `deadlineOn`):
 * started, not past its due date, and not completed on an earlier day. It
 * can be marked any day until `due_date`; after it, it becomes overdue.
 */
export const DeadlineHabit = z.object({
	habit: Habit,
	due_date: CalendarDate,
	/** Completed today: kept in the list (checked) so it can be unchecked. */
	completed_today: z.boolean(),
});
export type DeadlineHabit = z.infer<typeof DeadlineHabit>;

/**
 * The first completion of a deadline task on another day than the one shown
 * (2.13.0): the day of its due date, missed and done late, says "Já
 * concluída em DD/MM" instead of offering a second completion.
 */
export const DeadlineDone = z.object({
	habit_id: Uuid,
	date: CalendarDate,
});
export type DeadlineDone = z.infer<typeof DeadlineDone>;

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
	/**
	 * Only for the user's today (2.13.0, additive): open deadline tasks, by
	 * due date. Absent on other days and from older APIs.
	 */
	deadline: z.array(DeadlineHabit).optional(),
	/** Listed deadline tasks first completed on another day (2.13.0). */
	deadline_done: z.array(DeadlineDone).optional(),
});
export type DayResponse = z.infer<typeof DayResponse>;
