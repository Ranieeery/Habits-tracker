import { z } from "zod";
import { Completion } from "./completion.ts";
import { ApiErrorBody } from "./errors.ts";
import { Habit } from "./habit.ts";
import { CalendarDate, TimestampMs, Uuid } from "./primitives.ts";

export const SYNC_PROTOCOL_VERSION = 1;

/** Opaque server position in the change feed. */
export const SyncCursor = z.string().min(1);
export type SyncCursor = z.infer<typeof SyncCursor>;

const MutationBase = {
	/** Client-generated; the server applies each mutation at most once. */
	mutation_id: Uuid,
	/** When the client queued the mutation. */
	created_at: TimestampMs,
};

/**
 * Creates or replaces a habit (last write wins by `updated_at`). Deleting is
 * an upsert with `deleted_at` set.
 */
export const HabitUpsertMutation = z.object({
	...MutationBase,
	type: z.literal("habit.upsert"),
	record: Habit,
});
export type HabitUpsertMutation = z.infer<typeof HabitUpsertMutation>;

/** Marks a habit done or undone on a date; idempotent per `(habit_id, date)`. */
export const CompletionSetMutation = z.object({
	...MutationBase,
	type: z.literal("completion.set"),
	id: Uuid,
	habit_id: Uuid,
	date: CalendarDate,
	completed: z.boolean(),
	updated_at: TimestampMs,
});
export type CompletionSetMutation = z.infer<typeof CompletionSetMutation>;

export const Mutation = z.discriminatedUnion("type", [
	HabitUpsertMutation,
	CompletionSetMutation,
]);
export type Mutation = z.infer<typeof Mutation>;
export type MutationType = Mutation["type"];

export const SYNC_PUSH_MAX_MUTATIONS = 500;

export const SyncPushRequest = z.object({
	protocol: z.int().positive(),
	mutations: z.array(Mutation).max(SYNC_PUSH_MAX_MUTATIONS),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequest>;

export const MutationResult = z.object({
	mutation_id: Uuid,
	status: z.enum(["applied", "duplicate", "rejected"]),
	error: ApiErrorBody.optional(),
});
export type MutationResult = z.infer<typeof MutationResult>;

export const SyncPushResponse = z.object({
	results: z.array(MutationResult),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponse>;

export const SyncPullQuery = z.object({
	/** Omit for a full pull. */
	cursor: SyncCursor.optional(),
	limit: z.coerce.number().int().min(1).max(1000).optional(),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuery>;

/**
 * Records changed since the cursor, tombstones (`deleted_at` set) included.
 * New record kinds are added as new keys.
 */
export const SyncChanges = z.object({
	habits: z.array(Habit),
	completions: z.array(Completion),
});
export type SyncChanges = z.infer<typeof SyncChanges>;

export const SyncPullResponse = z.object({
	cursor: SyncCursor,
	has_more: z.boolean(),
	changes: SyncChanges,
});
export type SyncPullResponse = z.infer<typeof SyncPullResponse>;
