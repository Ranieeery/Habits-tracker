// Sync rules shared by the API (applying pushed mutations, REST writes) and
// the mobile app (showing pending mutations over its copy of the server
// records). Pure: the instant, the user's today and id generation are passed
// in.
//
// Conflict policy: last write wins in the order the server applies writes
// (arrival order), never by device clocks. Every instant a mutation writes
// (`created_at`, `updated_at`, `completed_at`, `archived_at`, `deleted_at`)
// is the applier's `now`. Habit updates only touch the fields they carry, so
// concurrent edits of different fields both survive. Completions are unique
// per `(habit_id, date)`: the first id stored for that key stays.
import type {
	ApiErrorBody,
	CalendarDate,
	Completion,
	ErrorCode,
	Habit,
	Mutation,
	UpdateHabitRequest,
} from "@habits/contracts";
import {
	checkHabitDates,
	earliestStartDate,
	MAX_DEADLINE_DAYS,
	type HabitDatesProblem,
} from "./schedule.ts";
import { addDays } from "./dates.ts";
import { keyAfterLast } from "./sort-key.ts";
import { isWithinWriteWindow, writeWindow } from "./window.ts";

/** Days the server keeps tombstones before purging them. */
export const TOMBSTONE_RETENTION_DAYS = 90;
/** Days the server remembers applied `mutation_id`s (idempotency). */
export const PROCESSED_MUTATION_RETENTION_DAYS = 90;

export interface HabitInput {
	id: string;
	name: string;
	/** Absent = empty (2.12.0). */
	description?: string;
	schedule: Habit["schedule"];
	start_date: CalendarDate;
	/** Position in the list; callers put a new habit last (`keyAfterLast`). */
	sort_key: string;
}

/** A new, live habit written at `now`. */
export function newHabit(input: HabitInput, now: number): Habit {
	return {
		id: input.id,
		name: input.name,
		description: input.description ?? "",
		schedule: input.schedule,
		start_date: input.start_date,
		archived_at: null,
		sort_key: input.sort_key,
		created_at: now,
		updated_at: now,
		deleted_at: null,
	};
}

/**
 * Rename, describe (2.12.0), reschedule, archive, unarchive or move (`sort_key`). Archiving an archived habit keeps
 * its original `archived_at`. `changed` is false when nothing differs, and
 * then `habit` is the input unchanged.
 */
export function applyHabitChanges(
	habit: Habit,
	changes: UpdateHabitRequest,
	now: number
): { habit: Habit; changed: boolean } {
	const { archived, ...fields } = changes;
	let archived_at = habit.archived_at;
	if (archived === true) archived_at ??= now;
	if (archived === false) archived_at = null;
	const name = fields.name ?? habit.name;
	const description = fields.description ?? habit.description;
	const schedule = fields.schedule ?? habit.schedule;
	const sort_key = fields.sort_key ?? habit.sort_key;
	const changed =
		name !== habit.name ||
		description !== habit.description ||
		JSON.stringify(schedule) !== JSON.stringify(habit.schedule) ||
		archived_at !== habit.archived_at ||
		sort_key !== habit.sort_key;
	if (!changed) return { habit, changed: false };
	return {
		habit: {
			...habit,
			name,
			description,
			schedule,
			archived_at,
			sort_key,
			updated_at: now,
		},
		changed: true,
	};
}

/**
 * Deletes a habit (2.11.0): a tombstone at `now`, everything else kept, so
 * a restore brings back the same habit and, since its completions are never
 * touched, the same history. Only archived habits can be deleted (archiving
 * is the default way out; the apps offer "Apagar" only on archived habits):
 * otherwise `archived_required`. Deleting a deleted habit keeps its first
 * `deleted_at`.
 */
export function applyHabitDelete(
	habit: Habit,
	now: number
): { habit: Habit; changed: boolean } | "archived_required" {
	if (habit.deleted_at !== null) return { habit, changed: false };
	if (habit.archived_at === null) return "archived_required";
	return {
		habit: { ...habit, deleted_at: now, updated_at: now },
		changed: true,
	};
}

/**
 * Restores a deleted habit (the "Desfazer" of a deletion). It stays archived.
 * Restoring a live habit changes nothing.
 */
export function applyHabitRestore(
	habit: Habit,
	now: number
): { habit: Habit; changed: boolean } {
	if (habit.deleted_at === null) return { habit, changed: false };
	return {
		habit: { ...habit, deleted_at: null, updated_at: now },
		changed: true,
	};
}

/** The rejection for deleting a habit that is not archived. */
export const ARCHIVED_REQUIRED_ERROR: ApiErrorBody = {
	code: "conflict",
	message: "Habit must be archived before deleting",
};

export interface CompletionSetInput {
	/** Id for a new row; an existing row for the habit and date keeps its own. */
	id: string;
	habit_id: string;
	date: CalendarDate;
	completed: boolean;
}

/**
 * Marks a habit done or undone on a date. Setting the current state changes
 * nothing. Undoing writes a tombstone (`deleted_at`), creating one when no
 * row exists, so the change syncs; marking a tombstone done again revives it
 * with the same id.
 */
export function applyCompletionSet(
	current: Completion | null,
	{ id, habit_id, date, completed }: CompletionSetInput,
	now: number
): { completion: Completion; changed: boolean } {
	if (!current) {
		return {
			completion: {
				id,
				habit_id,
				date,
				completed_at: now,
				created_at: now,
				updated_at: now,
				deleted_at: completed ? null : now,
			},
			changed: true,
		};
	}
	const isDone = current.deleted_at === null;
	if (isDone === completed) return { completion: current, changed: false };
	return {
		completion: {
			...current,
			completed_at: completed ? now : current.completed_at,
			updated_at: now,
			deleted_at: completed ? null : now,
		},
		changed: true,
	};
}

/** Key of the completions unique constraint. */
export function completionKey(habitId: string, date: CalendarDate): string {
	return `${habitId}|${date}`;
}

/** The records a sequence of mutations is applied to (one user's). */
export interface SyncState {
	habits: Map<string, Habit>;
	/** By `completionKey`. */
	completions: Map<string, Completion>;
}

export function syncState(
	habits: Iterable<Habit>,
	completions: Iterable<Completion>
): SyncState {
	const state: SyncState = { habits: new Map(), completions: new Map() };
	for (const habit of habits) state.habits.set(habit.id, habit);
	for (const completion of completions) {
		state.completions.set(
			completionKey(completion.habit_id, completion.date),
			completion
		);
	}
	return state;
}

export interface ApplyContext {
	now: number;
	/**
	 * The user's today. The server always passes it (date window checks); the
	 * app omits it so pending mutations show until the server decides.
	 */
	today?: CalendarDate;
	/** Whether an id is used by a record outside `state` (e.g. another user's). */
	isIdTaken?: (id: string) => boolean;
	/** A fresh id, for a completion whose proposed id is already taken. */
	newId: () => string;
}

export type ApplyOutcome =
	| {
			status: "applied";
			/** Id of the record the mutation touched, as stored. */
			canonical_id: string;
			/** Whether a record was written (false for no-ops). */
			changed: boolean;
	  }
	| { status: "rejected"; error: ApiErrorBody };

function reject(
	code: ErrorCode,
	message: string,
	details?: unknown
): ApplyOutcome {
	return {
		status: "rejected",
		error:
			details === undefined ? { code, message } : { code, message, details },
	};
}

/** The rejection for a `checkHabitDates` problem (REST answers the same). */
export function habitDatesError(
	problem: HabitDatesProblem,
	earliest: CalendarDate,
	today?: CalendarDate
): ApiErrorBody {
	switch (problem) {
		case "date_out_of_range":
			return {
				code: "date_out_of_range",
				message: "Date is before the earliest allowed date",
				details: { earliest },
			};
		case "due_date_too_far":
			return {
				code: "date_out_of_range",
				message: "Due date is too far ahead",
				details: {
					latest: today ? addDays(today, MAX_DEADLINE_DAYS) : undefined,
				},
			};
		case "deadline_passed":
			return {
				code: "validation_error",
				message: "Due date already passed and cannot change",
				details: { reason: "deadline_passed" },
			};
		case "date_before_start":
			return {
				code: "validation_error",
				message: "Single date is before the habit start date",
			};
		default: {
			const unknown: never = problem;
			throw new Error(`Unknown problem: ${String(unknown)}`);
		}
	}
}

function liveHabit(state: SyncState, habitId: string): Habit | null {
	const habit = state.habits.get(habitId);
	return habit && habit.deleted_at === null ? habit : null;
}

function isCompletionIdUsed(state: SyncState, id: string): boolean {
	for (const completion of state.completions.values()) {
		if (completion.id === id) return true;
	}
	return false;
}

/**
 * Applies one mutation to `state` (updated in place) and says what happened.
 * Rejections are permanent: the same mutation on the same state is rejected
 * again. Unknown habits and habits of other users are the same `not_found`.
 */
export function applyMutation(
	state: SyncState,
	mutation: Mutation,
	ctx: ApplyContext
): ApplyOutcome {
	switch (mutation.type) {
		case "habit.create": {
			const existing = state.habits.get(mutation.id);
			if (existing) {
				return { status: "applied", canonical_id: existing.id, changed: false };
			}
			if (ctx.isIdTaken?.(mutation.id)) {
				return reject("conflict", "Habit id already in use");
			}
			if (ctx.today !== undefined) {
				// Offline creations get the backfill window for every schedule.
				const earliest = earliestStartDate(mutation.schedule, ctx.today, {
					offline: true,
				});
				const problem = checkHabitDates(mutation, earliest, {
					today: ctx.today,
				});
				if (problem) {
					return {
						status: "rejected",
						error: habitDatesError(problem, earliest, ctx.today),
					};
				}
			}
			// Without a key (apps older than 2.4.0) the habit goes last.
			const sort_key = mutation.sort_key ?? keyAfterLast(state.habits.values());
			state.habits.set(
				mutation.id,
				newHabit({ ...mutation, sort_key }, ctx.now)
			);
			return { status: "applied", canonical_id: mutation.id, changed: true };
		}
		case "habit.update": {
			const habit = liveHabit(state, mutation.habit_id);
			if (!habit) return reject("not_found", "Habit not found");
			const { schedule } = mutation.changes;
			if (schedule !== undefined && ctx.today !== undefined) {
				const earliest = earliestStartDate(schedule, ctx.today, {
					offline: true,
				});
				const problem = checkHabitDates(
					{ schedule, start_date: habit.start_date },
					earliest,
					{ checkStart: false, today: ctx.today, previous: habit.schedule }
				);
				if (problem) {
					return {
						status: "rejected",
						error: habitDatesError(problem, earliest, ctx.today),
					};
				}
			}
			const result = applyHabitChanges(habit, mutation.changes, ctx.now);
			if (result.changed) state.habits.set(habit.id, result.habit);
			return {
				status: "applied",
				canonical_id: habit.id,
				changed: result.changed,
			};
		}
		case "habit.delete": {
			// Deleted habits included: deleting twice is not an error.
			const habit = state.habits.get(mutation.habit_id);
			if (!habit) return reject("not_found", "Habit not found");
			const result = applyHabitDelete(habit, ctx.now);
			if (result === "archived_required") {
				return { status: "rejected", error: ARCHIVED_REQUIRED_ERROR };
			}
			if (result.changed) state.habits.set(habit.id, result.habit);
			return {
				status: "applied",
				canonical_id: habit.id,
				changed: result.changed,
			};
		}
		case "habit.restore": {
			const habit = state.habits.get(mutation.habit_id);
			if (!habit) return reject("not_found", "Habit not found");
			const result = applyHabitRestore(habit, ctx.now);
			if (result.changed) state.habits.set(habit.id, result.habit);
			return {
				status: "applied",
				canonical_id: habit.id,
				changed: result.changed,
			};
		}
		case "completion.set": {
			if (!liveHabit(state, mutation.habit_id)) {
				return reject("not_found", "Habit not found");
			}
			if (
				ctx.today !== undefined &&
				!isWithinWriteWindow(mutation.date, ctx.today)
			) {
				return reject(
					"date_out_of_range",
					"Date is outside the editable window",
					writeWindow(ctx.today)
				);
			}
			const key = completionKey(mutation.habit_id, mutation.date);
			const current = state.completions.get(key) ?? null;
			let id = mutation.id;
			if (
				!current &&
				(ctx.isIdTaken?.(id) === true || isCompletionIdUsed(state, id))
			) {
				id = ctx.newId();
			}
			const result = applyCompletionSet(current, { ...mutation, id }, ctx.now);
			if (result.changed) state.completions.set(key, result.completion);
			return {
				status: "applied",
				canonical_id: result.completion.id,
				changed: result.changed,
			};
		}
		default: {
			const unknown: never = mutation;
			throw new Error(`Unknown mutation: ${JSON.stringify(unknown)}`);
		}
	}
}

/**
 * The records as the app shows them: the server's records (`mirror`) with the
 * pending mutations replayed on top, in outbox order. A pending mutation the
 * server would reject (e.g. its habit is gone) is skipped, so the screen
 * shows the server state for it.
 */
export function materialize(
	mirror: { habits: Iterable<Habit>; completions: Iterable<Completion> },
	pending: readonly Mutation[],
	ctx: ApplyContext
): SyncState {
	const state = syncState(mirror.habits, mirror.completions);
	for (const mutation of pending) applyMutation(state, mutation, ctx);
	return state;
}

/** The habit a mutation needs to exist first, if any. */
export function habitDependency(mutation: Mutation): string | null {
	switch (mutation.type) {
		case "habit.create":
			return null;
		case "habit.update":
		case "habit.delete":
		case "habit.restore":
		case "completion.set":
			return mutation.habit_id;
		default: {
			const unknown: never = mutation;
			throw new Error(`Unknown mutation: ${JSON.stringify(unknown)}`);
		}
	}
}

export interface OutboxItem {
	/** Local insertion order. */
	seq: number;
	mutation: Mutation;
}

/**
 * Send order: by `seq`, except that the `habit.create` of a habit always goes
 * before any other mutation of that habit (a stable topological order). Items
 * keep their relative order otherwise, so the server sees a device's changes
 * in the order they were made.
 */
export function orderOutbox<T extends OutboxItem>(items: readonly T[]): T[] {
	const sorted = [...items].sort((a, b) => a.seq - b.seq);
	const createOf = new Map<string, T>();
	for (const item of sorted) {
		if (item.mutation.type === "habit.create") {
			createOf.set(item.mutation.id, item);
		}
	}
	const emitted = new Set<T>();
	const ordered: T[] = [];
	for (const item of sorted) {
		if (emitted.has(item)) continue;
		const dependency = habitDependency(item.mutation);
		const create = dependency ? createOf.get(dependency) : undefined;
		if (create && !emitted.has(create)) {
			emitted.add(create);
			ordered.push(create);
		}
		emitted.add(item);
		ordered.push(item);
	}
	return ordered;
}

/**
 * Mutation ids that must not be sent because the `habit.create` they depend
 * on failed permanently (it is in `failedMutationIds`). They would only be
 * rejected as `not_found`.
 */
export function blockedBy(
	items: readonly OutboxItem[],
	failedMutationIds: ReadonlySet<string>
): Map<string, string> {
	const failedCreates = new Map<string, string>();
	for (const { mutation } of items) {
		if (
			mutation.type === "habit.create" &&
			failedMutationIds.has(mutation.mutation_id)
		) {
			failedCreates.set(mutation.id, mutation.mutation_id);
		}
	}
	const blocked = new Map<string, string>();
	for (const { mutation } of items) {
		const dependency = habitDependency(mutation);
		const create = dependency ? failedCreates.get(dependency) : undefined;
		if (create && !failedMutationIds.has(mutation.mutation_id)) {
			blocked.set(mutation.mutation_id, create);
		}
	}
	return blocked;
}

/**
 * Rewrites completion ids the server replaced (`localId -> canonicalId`) in
 * mutations still to be sent. Habit ids are never replaced: a taken habit id
 * is a rejection.
 */
export function remapIds(
	mutations: readonly Mutation[],
	canonicalIds: ReadonlyMap<string, string>
): Mutation[] {
	return mutations.map((mutation) => {
		if (mutation.type !== "completion.set") return mutation;
		const canonical = canonicalIds.get(mutation.id);
		return canonical && canonical !== mutation.id
			? { ...mutation, id: canonical }
			: mutation;
	});
}
