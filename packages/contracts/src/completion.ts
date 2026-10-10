import { z } from "zod";
import { CalendarDate, TimestampMs, Uuid } from "./primitives.ts";
import { SyncableFields } from "./syncable.ts";

/** A habit done on a local date. Unique per `(habit_id, date)`. */
export const Completion = z.object({
	...SyncableFields,
	habit_id: Uuid,
	date: CalendarDate,
	completed_at: TimestampMs,
});
export type Completion = z.infer<typeof Completion>;

export const CompletionParams = z.object({
	habit_id: Uuid,
	date: CalendarDate,
});
export type CompletionParams = z.infer<typeof CompletionParams>;

/** Marks a habit as done (`completed: true`) or undone on the date. */
export const SetCompletionRequest = z.object({
	completed: z.boolean(),
	/** Client-generated id for a new completion row. */
	id: Uuid.optional(),
});
export type SetCompletionRequest = z.infer<typeof SetCompletionRequest>;

export const CompletionResponse = z.object({ completion: Completion });
export type CompletionResponse = z.infer<typeof CompletionResponse>;
