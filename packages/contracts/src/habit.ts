import { z } from "zod";
import { CalendarDate, TimestampMs, Uuid } from "./primitives.ts";
import { Schedule, StoredSchedule } from "./schedule.ts";
import { SyncableFields } from "./syncable.ts";

export const HabitName = z.string().trim().min(1).max(120);

/** Longest description (2.12.0), in characters. */
export const DESCRIPTION_MAX_LENGTH = 5000;

/**
 * Optional notes of a habit (2.12.0): plain text with a little Markdown
 * (bold, italic, lists, links; core `parseDescription`). Empty = none.
 */
export const HabitDescription = z.string().trim().max(DESCRIPTION_MAX_LENGTH);
export type HabitDescription = z.infer<typeof HabitDescription>;

/**
 * Position of a habit in the user's list (2.4.0): a fractional index in
 * base 62 (ASCII order: 0-9, A-Z, a-z), compared as plain strings. Moving a
 * habit writes only its own key, between its new neighbors (core
 * `keyBetween`), so a reorder is one field change that merges like any other.
 */
export const SortKey = z
	.string()
	.max(64)
	.regex(/^[0-9A-Za-z]+$/);
export type SortKey = z.infer<typeof SortKey>;

export const Habit = z.object({
	...SyncableFields,
	name: HabitName,
	/** Empty when none; defaults to empty from an API older than 2.12.0. */
	description: z.string().max(DESCRIPTION_MAX_LENGTH).default(""),
	/**
	 * Read tolerantly: a schedule type from a newer version is kept as is (see
	 * `UnsupportedSchedule`). Writes always validate with `Schedule`.
	 */
	schedule: StoredSchedule,
	/** First local date on which the habit is possible. */
	start_date: CalendarDate,
	archived_at: TimestampMs.nullable(),
	/**
	 * Order in the list (`sortHabits` in core). Empty sorts last; defaults to
	 * empty when reading from an API older than 2.4.0.
	 */
	sort_key: z.union([SortKey, z.literal("")]).default(""),
});
export type Habit = z.infer<typeof Habit>;

export const CreateHabitRequest = z.object({
	/** Client-generated id (UUID v7), so offline clients can create habits. */
	id: Uuid.optional(),
	name: HabitName,
	/** Optional (2.12.0): absent = empty. */
	description: HabitDescription.optional(),
	schedule: Schedule,
	start_date: CalendarDate,
	/** Where the habit goes; absent = after the last one (server assigns). */
	sort_key: SortKey.optional(),
});
export type CreateHabitRequest = z.infer<typeof CreateHabitRequest>;

export const UpdateHabitRequest = z
	.object({
		name: HabitName,
		/** Empty clears it (2.12.0). */
		description: HabitDescription,
		schedule: Schedule,
		archived: z.boolean(),
		/** Moves the habit (a key between its new neighbors). */
		sort_key: SortKey,
	})
	.partial();
export type UpdateHabitRequest = z.infer<typeof UpdateHabitRequest>;

export const HabitParams = z.object({ habit_id: Uuid });
export type HabitParams = z.infer<typeof HabitParams>;

export const HabitResponse = z.object({ habit: Habit });
export type HabitResponse = z.infer<typeof HabitResponse>;

export const HabitListResponse = z.object({
	habits: z.array(Habit),
	/**
	 * First completion of each deadline task that has one (2.13.0, additive):
	 * done tasks go to "Passados". Absent from older APIs.
	 */
	deadline_completions: z
		.array(z.object({ habit_id: Uuid, date: CalendarDate }))
		.optional(),
});
export type HabitListResponse = z.infer<typeof HabitListResponse>;
