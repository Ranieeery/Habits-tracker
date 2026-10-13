import { z } from "zod";
import { Completion } from "./completion.ts";
import { ApiErrorBody } from "./errors.ts";
import {
	Habit,
	HabitDescription,
	HabitName,
	SortKey,
	UpdateHabitRequest,
} from "./habit.ts";
import { CalendarDate, TimestampMs, Uuid } from "./primitives.ts";
import { Schedule } from "./schedule.ts";

export const SYNC_PROTOCOL_VERSION = 1;

/**
 * Opaque server position in the change feed. Clients store it and send it
 * back; they never parse it.
 */
export const SyncCursor = z.string().min(1);
export type SyncCursor = z.infer<typeof SyncCursor>;

const MutationBase = {
	/** Client-generated; the server applies each mutation at most once. */
	mutation_id: Uuid,
	/** When the client queued the mutation (device clock: informative only). */
	created_at: TimestampMs,
};

/**
 * Creates a habit with a client-generated id, like `POST /v1/habits`. Sending
 * it again for an existing habit of the same user changes nothing.
 */
export const HabitCreateMutation = z.object({
	...MutationBase,
	type: z.literal("habit.create"),
	id: Uuid,
	name: HabitName,
	/** Optional (2.12.0): absent = empty. */
	description: HabitDescription.optional(),
	schedule: Schedule,
	start_date: CalendarDate,
	/** Optional (2.4.0): absent = after the user's last habit. */
	sort_key: SortKey.optional(),
});
export type HabitCreateMutation = z.infer<typeof HabitCreateMutation>;

/**
 * Changes some fields of a habit, like `PATCH /v1/habits/{habit_id}`. Only the
 * fields present are written, so concurrent edits of different fields from
 * two devices both survive (last write wins per field, in server order).
 */
export const HabitUpdateMutation = z.object({
	...MutationBase,
	type: z.literal("habit.update"),
	habit_id: Uuid,
	changes: UpdateHabitRequest,
});
export type HabitUpdateMutation = z.infer<typeof HabitUpdateMutation>;

/**
 * Deletes an archived habit (2.11.0), like `DELETE /v1/habits/{habit_id}`:
 * a tombstone (`deleted_at`), so the habit leaves every day, past ones too,
 * until it is restored or purged. Rejected with `conflict` when the habit is
 * not archived; deleting a deleted habit changes nothing. A new type instead
 * of a field of `habit.update`: an older API rejects an unknown type alone,
 * while it would silently drop an unknown field.
 */
export const HabitDeleteMutation = z.object({
	...MutationBase,
	type: z.literal("habit.delete"),
	habit_id: Uuid,
});
export type HabitDeleteMutation = z.infer<typeof HabitDeleteMutation>;

/**
 * Brings a deleted habit back (2.11.0, the "Desfazer" of a deletion), like
 * `POST /v1/habits/{habit_id}/restore`. It stays archived; its completions
 * were never touched, so its history returns as it was. Restoring a live
 * habit changes nothing.
 */
export const HabitRestoreMutation = z.object({
	...MutationBase,
	type: z.literal("habit.restore"),
	habit_id: Uuid,
});
export type HabitRestoreMutation = z.infer<typeof HabitRestoreMutation>;

/**
 * Marks a habit done or undone on a date; idempotent per `(habit_id, date)`.
 * `id` is the id the client gave the completion; if the server already has a
 * completion for that habit and date, it keeps its own id and answers it as
 * `canonical_id`.
 */
export const CompletionSetMutation = z.object({
	...MutationBase,
	type: z.literal("completion.set"),
	id: Uuid,
	habit_id: Uuid,
	date: CalendarDate,
	completed: z.boolean(),
	/** Ignored: the server orders writes by arrival, never by device clocks. */
	updated_at: TimestampMs.optional(),
});
export type CompletionSetMutation = z.infer<typeof CompletionSetMutation>;

export const Mutation = z.discriminatedUnion("type", [
	HabitCreateMutation,
	HabitUpdateMutation,
	HabitDeleteMutation,
	HabitRestoreMutation,
	CompletionSetMutation,
]);
export type Mutation = z.infer<typeof Mutation>;
export type MutationType = Mutation["type"];

/**
 * Per request. Keeps one push inside the D1 Free plan budget of 50 queries
 * per invocation (writes are chunked multi-row statements in one batch).
 */
export const SYNC_PUSH_MAX_MUTATIONS = 100;

export const SyncPushRequest = z.object({
	protocol: z.int().positive(),
	mutations: z.array(Mutation).max(SYNC_PUSH_MAX_MUTATIONS),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequest>;

/**
 * What the server validates for the whole request. Each mutation is then
 * parsed on its own with `Mutation`, so one invalid mutation (or a type a
 * newer client knows and this server does not) is rejected alone instead of
 * failing the batch.
 */
export const SyncPushEnvelope = z.object({
	protocol: z.int().positive(),
	mutations: z
		.array(z.looseObject({ mutation_id: Uuid }))
		.max(SYNC_PUSH_MAX_MUTATIONS),
});
export type SyncPushEnvelope = z.infer<typeof SyncPushEnvelope>;

export const MutationResult = z.object({
	mutation_id: Uuid,
	/**
	 * `applied`: written now. `duplicate`: this `mutation_id` was applied
	 * before (nothing written). `rejected`: permanent, see `error`; retrying
	 * the same mutation gives the same answer unless the data changed.
	 */
	status: z.enum(["applied", "duplicate", "rejected"]),
	/** Id the server keeps for the record the mutation touched. */
	canonical_id: Uuid.optional(),
	error: ApiErrorBody.optional(),
});
export type MutationResult = z.infer<typeof MutationResult>;

export const SyncPushResponse = z.object({
	/** One per mutation, in request order. */
	results: z.array(MutationResult),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponse>;

export const SYNC_PULL_DEFAULT_LIMIT = 200;
export const SYNC_PULL_MAX_LIMIT = 500;

export const SyncPullQuery = z.object({
	/** Omit for a full pull. */
	cursor: SyncCursor.optional(),
	limit: z.coerce.number().int().min(1).max(SYNC_PULL_MAX_LIMIT).optional(),
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
	/**
	 * The cursor is no longer usable (older than the tombstone retention, or
	 * unknown to this server): `changes` is empty and the client must drop its
	 * copy of the records and pull again without a cursor.
	 */
	reset: z.boolean().optional(),
	/** Records still to pull after this page (for progress bars). */
	remaining: z.int().nonnegative().optional(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponse>;
