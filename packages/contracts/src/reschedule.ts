import { z } from "zod";
import { Habit } from "./habit.ts";
import { CalendarDate, Uuid } from "./primitives.ts";
import { SyncableFields } from "./syncable.ts";

/**
 * One postponement of a single occurrence of a fixed-day habit (2.16.0: a
 * single date or days of the month). Append-only: the occurrence's nominal
 * date stays `original_date`, its effective date is the `to_date` of its live
 * row with the highest `sequence`, and undoing tombstones that row. The rules
 * (limits, valid dates, orphans) live in core `reschedule.ts`.
 */
export const HabitReschedule = z.object({
	...SyncableFields,
	habit_id: Uuid,
	/** The occurrence's nominal date (from the habit's schedule). */
	original_date: CalendarDate,
	/** Its effective date before this postponement. */
	from_date: CalendarDate,
	/** Its effective date after it. */
	to_date: CalendarDate,
	/** 1 for the first postponement of the occurrence, 2 for the second. */
	sequence: z.int().positive(),
});
export type HabitReschedule = z.infer<typeof HabitReschedule>;

export const RescheduleParams = z.object({ habit_id: Uuid });
export type RescheduleParams = z.infer<typeof RescheduleParams>;

export const RescheduleItemParams = z.object({
	habit_id: Uuid,
	reschedule_id: Uuid,
});
export type RescheduleItemParams = z.infer<typeof RescheduleItemParams>;

/**
 * Postpones one occurrence, like the sync `reschedule.create`. `from_date`
 * and `sequence` are what the client saw (its effective date and live count
 * + 1): when another device postponed it meanwhile, the server answers 409.
 * Idempotent per `id`.
 */
export const CreateRescheduleRequest = z.object({
	id: Uuid,
	original_date: CalendarDate,
	from_date: CalendarDate,
	to_date: CalendarDate,
	sequence: z.int().positive(),
});
export type CreateRescheduleRequest = z.infer<typeof CreateRescheduleRequest>;

export const RescheduleResponse = z.object({ reschedule: HabitReschedule });
export type RescheduleResponse = z.infer<typeof RescheduleResponse>;

/**
 * The live postponements of the user and the live completions of the habits
 * they belong to (a completion between the nominal and the effective date
 * fulfills the occurrence early), for views the web computes locally.
 */
export const ReschedulesResponse = z.object({
	reschedules: z.array(HabitReschedule),
	completions: z.array(
		z.object({ habit_id: Uuid, date: CalendarDate, deleted_at: z.null() })
	),
});
export type ReschedulesResponse = z.infer<typeof ReschedulesResponse>;

/** An occurrence that lives on the day shown, postponed from another date. */
export const MovedIn = z.object({
	habit_id: Uuid,
	original_date: CalendarDate,
	/** Live postponements of this occurrence (1 or 2). */
	count: z.int().positive(),
});
export type MovedIn = z.infer<typeof MovedIn>;

/** An occurrence nominally on the day shown, postponed to `to_date`. */
export const MovedOut = z.object({
	habit: Habit,
	to_date: CalendarDate,
});
export type MovedOut = z.infer<typeof MovedOut>;
