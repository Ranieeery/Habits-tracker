// Database side of the sync protocol. Every statement is scoped by `userId`
// except `findTakenIds` (an id-only existence probe, so a client cannot reuse
// another user's record id) and `listSyncUsers` (the cron's purge loop).
//
// Statement budget (D1 Free: 50 queries per invocation; each statement of a
// batch is counted): a push reads at most ~6 times and writes in one batch of
// chunked multi-row statements; a pull is one batch of 5 reads.
import type {
	CalendarDate,
	Completion,
	Habit,
	UpdateHabitRequest,
} from "@habits/contracts";
import { completionKey } from "@habits/core";
import {
	and,
	count,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	lt,
	lte,
	sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { chunk, columnCount } from "../db/chunk.ts";
import type { Db } from "../db/client.ts";
import {
	fromCompletionRow,
	fromHabitRow,
	toCompletionRow,
	toHabitRow,
} from "../db/records.ts";
import {
	completions,
	habits,
	processedMutations,
	syncState,
} from "../db/schema.ts";
import { changedHabitFields } from "./habits.ts";

/** Applied mutation ids among `mutationIds`, with their canonical record id. */
export async function findProcessedMutations(
	db: Db,
	userId: string,
	mutationIds: readonly string[]
): Promise<Map<string, string>> {
	const found = new Map<string, string>();
	for (const ids of chunk(mutationIds, 1, 1)) {
		const rows = await db
			.select({
				mutation_id: processedMutations.mutation_id,
				canonical_id: processedMutations.canonical_id,
			})
			.from(processedMutations)
			.where(
				and(
					eq(processedMutations.user_id, userId),
					inArray(processedMutations.mutation_id, ids)
				)
			);
		for (const row of rows) found.set(row.mutation_id, row.canonical_id);
	}
	return found;
}

/**
 * The user's habits with these ids (deleted ones included) and their
 * completions within the dates a push may write.
 */
export async function loadSyncRecords(
	db: Db,
	userId: string,
	habitIds: readonly string[],
	window: { from: CalendarDate; to: CalendarDate }
): Promise<{ habits: Habit[]; completions: Completion[] }> {
	const habitRows = [];
	const completionRows = [];
	for (const ids of chunk(habitIds, 1, 3)) {
		const [h, c] = await db.batch([
			db
				.select()
				.from(habits)
				.where(and(eq(habits.user_id, userId), inArray(habits.id, ids))),
			db
				.select()
				.from(completions)
				.where(
					and(
						eq(completions.user_id, userId),
						inArray(completions.habit_id, ids),
						gte(completions.date, window.from),
						lte(completions.date, window.to)
					)
				),
		]);
		habitRows.push(...h);
		completionRows.push(...c);
	}
	return {
		habits: habitRows.map(fromHabitRow),
		completions: completionRows.map(fromCompletionRow),
	};
}

/**
 * Which of these ids already exist as a habit or completion of anyone. Only
 * ids leave the database; used to reject or replace ids a client proposes.
 */
export async function findTakenIds(
	db: Db,
	ids: readonly string[]
): Promise<Set<string>> {
	const taken = new Set<string>();
	for (const part of chunk(ids, 1)) {
		const [h, c] = await db.batch([
			db.select({ id: habits.id }).from(habits).where(inArray(habits.id, part)),
			db
				.select({ id: completions.id })
				.from(completions)
				.where(inArray(completions.id, part)),
		]);
		for (const row of [...h, ...c]) taken.add(row.id);
	}
	return taken;
}

export interface SyncWrites {
	newHabits: Habit[];
	habitUpdates: { habit: Habit; changes: UpdateHabitRequest }[];
	/** Final state of every completion written (new or changed). */
	completions: Completion[];
	processed: { mutation_id: string; canonical_id: string }[];
}

/**
 * Writes a push in one atomic batch. Completions are upserted on their
 * natural key `(habit_id, date)`, so a row a concurrent push inserted for the
 * same key keeps its id; the returned map is the stored id per key. The
 * plain insert into `processed_mutations` makes a concurrent duplicate of the
 * same push fail as a whole (the client retries and gets `duplicate`).
 */
export async function writeSyncChanges(
	db: Db,
	userId: string,
	writes: SyncWrites,
	now: number
): Promise<Map<string, string>> {
	const statements: BatchItem<"sqlite">[] = [];
	for (const rows of chunk(writes.newHabits, columnCount(habits))) {
		statements.push(
			db.insert(habits).values(rows.map((habit) => toHabitRow(userId, habit)))
		);
	}
	for (const { habit, changes } of writes.habitUpdates) {
		statements.push(
			db
				.update(habits)
				.set(changedHabitFields(userId, habit, changes))
				.where(and(eq(habits.user_id, userId), eq(habits.id, habit.id)))
		);
	}
	const completionStatements = chunk(
		writes.completions,
		columnCount(completions)
	).map((rows) =>
		db
			.insert(completions)
			.values(rows.map((completion) => toCompletionRow(userId, completion)))
			.onConflictDoUpdate({
				target: [completions.habit_id, completions.date],
				set: {
					completed_at: sql`excluded.completed_at`,
					updated_at: sql`excluded.updated_at`,
					deleted_at: sql`excluded.deleted_at`,
				},
				setWhere: sql`${completions.user_id} = excluded.user_id`,
			})
			.returning({
				id: completions.id,
				habit_id: completions.habit_id,
				date: completions.date,
			})
	);
	const firstCompletion = statements.length;
	statements.push(...completionStatements);
	for (const rows of chunk(writes.processed, columnCount(processedMutations))) {
		statements.push(
			db
				.insert(processedMutations)
				.values(
					rows.map((row) => ({ ...row, user_id: userId, processed_at: now }))
				)
		);
	}
	const [first, ...rest] = statements;
	if (!first) return new Map();
	const results = await db.batch([first, ...rest]);

	const stored = new Map<string, string>();
	for (const result of results.slice(
		firstCompletion,
		firstCompletion + completionStatements.length
	)) {
		for (const row of result as {
			id: string;
			habit_id: string;
			date: string;
		}[]) {
			stored.set(completionKey(row.habit_id, row.date), row.id);
		}
	}
	return stored;
}

export interface SyncPosition {
	/** Last seq given to one of the user's rows (0 before any write). */
	seq: number;
	/** Highest seq among purged tombstones. */
	purgedSeq: number;
}

export interface ChangesPage {
	position: SyncPosition;
	habits: (Habit & { server_seq: number })[];
	completions: (Completion & { server_seq: number })[];
	/** Rows with a seq above the cursor, this page included. */
	total: number;
}

/**
 * Up to `limit + 1` rows of each table with `server_seq > afterSeq`, in seq
 * order, plus the counters. One batch, so every read sees the same committed
 * state: rows with seq <= the newest one returned cannot appear later.
 */
export async function readChanges(
	db: Db,
	userId: string,
	afterSeq: number,
	limit: number
): Promise<ChangesPage> {
	const [state, habitRows, completionRows, habitCount, completionCount] =
		await db.batch([
			db
				.select({ seq: syncState.seq, purgedSeq: syncState.purged_seq })
				.from(syncState)
				.where(eq(syncState.user_id, userId)),
			db
				.select()
				.from(habits)
				.where(and(eq(habits.user_id, userId), gt(habits.server_seq, afterSeq)))
				.orderBy(habits.server_seq)
				.limit(limit + 1),
			db
				.select()
				.from(completions)
				.where(
					and(
						eq(completions.user_id, userId),
						gt(completions.server_seq, afterSeq)
					)
				)
				.orderBy(completions.server_seq)
				.limit(limit + 1),
			db
				.select({ n: count() })
				.from(habits)
				.where(
					and(eq(habits.user_id, userId), gt(habits.server_seq, afterSeq))
				),
			db
				.select({ n: count() })
				.from(completions)
				.where(
					and(
						eq(completions.user_id, userId),
						gt(completions.server_seq, afterSeq)
					)
				),
		]);
	return {
		position: state[0] ?? { seq: 0, purgedSeq: 0 },
		habits: habitRows.map((row) => ({
			...fromHabitRow(row),
			server_seq: row.server_seq,
		})),
		completions: completionRows.map((row) => ({
			...fromCompletionRow(row),
			server_seq: row.server_seq,
		})),
		total: (habitCount[0]?.n ?? 0) + (completionCount[0]?.n ?? 0),
	};
}

/** Users with sync bookkeeping (the cron's purge loop; ids only). */
export async function listSyncUsers(db: Db): Promise<string[]> {
	const rows = await db
		.select({ user_id: syncState.user_id })
		.from(syncState)
		.orderBy(syncState.user_id);
	return rows.map((row) => row.user_id);
}

/**
 * Deletes the user's tombstones (and the completions of deleted habits) and
 * applied mutation ids older than `cutoff`, raising `purged_seq` first so
 * cursors that could have missed a purged deletion are told to start over.
 */
export async function purgeExpired(
	db: Db,
	userId: string,
	cutoff: number
): Promise<void> {
	const deadHabit = and(
		eq(habits.user_id, userId),
		isNotNull(habits.deleted_at),
		lt(habits.deleted_at, cutoff)
	);
	const deadHabitIds = db
		.select({ id: habits.id })
		.from(habits)
		.where(deadHabit);
	const deadCompletion = and(
		eq(completions.user_id, userId),
		sql`((${completions.deleted_at} IS NOT NULL AND ${completions.deleted_at} < ${cutoff}) OR ${completions.habit_id} IN ${deadHabitIds})`
	);
	await db.batch([
		db
			.update(syncState)
			.set({
				purged_seq: sql`max(${syncState.purged_seq}, coalesce((${db
					.select({ seq: sql`max(${habits.server_seq})` })
					.from(habits)
					.where(deadHabit)}), 0), coalesce((${db
					.select({ seq: sql`max(${completions.server_seq})` })
					.from(completions)
					.where(deadCompletion)}), 0))`,
			})
			.where(eq(syncState.user_id, userId)),
		db.delete(completions).where(deadCompletion),
		db.delete(habits).where(deadHabit),
		db
			.delete(processedMutations)
			.where(
				and(
					eq(processedMutations.user_id, userId),
					lt(processedMutations.processed_at, cutoff)
				)
			),
	]);
}
