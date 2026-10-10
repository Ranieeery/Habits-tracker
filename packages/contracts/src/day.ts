import { z } from "zod";
import { Habit } from "./habit.ts";
import { CalendarDate, Uuid } from "./primitives.ts";

export const DayQuery = z.object({ date: CalendarDate });
export type DayQuery = z.infer<typeof DayQuery>;

/** Habits possible on a local date and which of them were completed. */
export const DayResponse = z.object({
	date: CalendarDate,
	possible_habits: z.array(Habit),
	completed_habit_ids: z.array(Uuid),
});
export type DayResponse = z.infer<typeof DayResponse>;
