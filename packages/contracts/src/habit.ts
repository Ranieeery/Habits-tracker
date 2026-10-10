import { z } from "zod";
import { CalendarDate, TimestampMs, Uuid } from "./primitives.ts";
import { Schedule } from "./schedule.ts";
import { SyncableFields } from "./syncable.ts";

export const HabitName = z.string().trim().min(1).max(120);

export const Habit = z.object({
	...SyncableFields,
	name: HabitName,
	schedule: Schedule,
	/** First local date on which the habit is possible. */
	start_date: CalendarDate,
	archived_at: TimestampMs.nullable(),
});
export type Habit = z.infer<typeof Habit>;

export const CreateHabitRequest = z.object({
	/** Client-generated id (UUID v7), so offline clients can create habits. */
	id: Uuid.optional(),
	name: HabitName,
	schedule: Schedule,
	start_date: CalendarDate,
});
export type CreateHabitRequest = z.infer<typeof CreateHabitRequest>;

export const UpdateHabitRequest = z
	.object({
		name: HabitName,
		schedule: Schedule,
		archived: z.boolean(),
	})
	.partial();
export type UpdateHabitRequest = z.infer<typeof UpdateHabitRequest>;

export const HabitParams = z.object({ habit_id: Uuid });
export type HabitParams = z.infer<typeof HabitParams>;

export const HabitResponse = z.object({ habit: Habit });
export type HabitResponse = z.infer<typeof HabitResponse>;

export const HabitListResponse = z.object({ habits: z.array(Habit) });
export type HabitListResponse = z.infer<typeof HabitListResponse>;
