import type {
	ApiErrorBody,
	Habit,
	UpdateHabitRequest,
} from "@habits/contracts";
import {
	applyHabitChanges,
	applyHabitDelete,
	applyHabitRestore,
	ARCHIVED_REQUIRED_ERROR,
} from "@habits/core";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { fromHabitRow, toHabitPatchRow, toHabitRow } from "../db/records.ts";
import { habits } from "../db/schema.ts";

const ownedBy = (userId: string) =>
	and(eq(habits.user_id, userId), isNull(habits.deleted_at));

/**
 * The user's habits that are not deleted (archived ones included), in list
 * order: by `sort_key` with empty keys last, then by creation (core
 * `compareHabitOrder`). Day views, the digest and the clients follow it.
 */
export async function listHabits(db: Db, userId: string): Promise<Habit[]> {
	const rows = await db
		.select()
		.from(habits)
		.where(ownedBy(userId))
		.orderBy(
			asc(sql`${habits.sort_key} = ''`),
			asc(habits.sort_key),
			asc(habits.created_at),
			asc(habits.id)
		);
	return rows.map(fromHabitRow);
}

export async function getHabit(
	db: Db,
	userId: string,
	habitId: string
): Promise<Habit | null> {
	const row = await db.query.habits.findFirst({
		where: and(ownedBy(userId), eq(habits.id, habitId)),
	});
	return row ? fromHabitRow(row) : null;
}

/**
 * Inserts the habit unless its id already exists. Returns the stored habit of
 * this user with that id (the new one, or the one a retried request created),
 * or null when the id belongs to another user.
 */
export async function insertHabit(
	db: Db,
	userId: string,
	habit: Habit
): Promise<{ habit: Habit; created: boolean } | null> {
	const [inserted] = await db
		.insert(habits)
		.values(toHabitRow(userId, habit))
		.onConflictDoNothing({ target: habits.id })
		.returning();
	if (inserted) return { habit: fromHabitRow(inserted), created: true };
	const existing = await getHabit(db, userId, habit.id);
	return existing ? { habit: existing, created: false } : null;
}

/**
 * Applies the changes (rules in `applyHabitChanges`, shared with sync); null
 * if the habit is not the user's. Only the fields the request carries are
 * written, so a concurrent change of another field is kept. `check` may
 * refuse the change after seeing the current habit (nothing is written).
 */
export async function updateHabit(
	db: Db,
	userId: string,
	habitId: string,
	changes: UpdateHabitRequest,
	now: number,
	check?: (current: Habit) => ApiErrorBody | null
): Promise<Habit | { error: ApiErrorBody } | null> {
	const current = await getHabit(db, userId, habitId);
	if (!current) return null;
	const error = check?.(current);
	if (error) return { error };
	const result = applyHabitChanges(current, changes, now);
	if (!result.changed) return current;
	const [row] = await db
		.update(habits)
		.set(changedHabitFields(userId, result.habit, changes))
		.where(and(ownedBy(userId), eq(habits.id, habitId)))
		.returning();
	return row ? fromHabitRow(row) : null;
}

/**
 * A habit of the user, deleted ones included (deleting twice and restoring
 * need them). Still scoped by `user_id`: another user's habit is null.
 */
async function getHabitIncludingDeleted(
	db: Db,
	userId: string,
	habitId: string
): Promise<Habit | null> {
	const row = await db.query.habits.findFirst({
		where: and(eq(habits.user_id, userId), eq(habits.id, habitId)),
	});
	return row ? fromHabitRow(row) : null;
}

async function writeDeletion(
	db: Db,
	userId: string,
	next: Habit
): Promise<Habit | null> {
	const [row] = await db
		.update(habits)
		.set(
			changedHabitFields(userId, next, { deleted: next.deleted_at !== null })
		)
		.where(and(eq(habits.user_id, userId), eq(habits.id, next.id)))
		.returning();
	return row ? fromHabitRow(row) : null;
}

/**
 * Deletes an archived habit (rules in `applyHabitDelete`, shared with sync):
 * a tombstone, its completions untouched. Null if the habit is not the
 * user's; deleting a deleted habit returns it unchanged.
 */
export async function deleteHabit(
	db: Db,
	userId: string,
	habitId: string,
	now: number
): Promise<Habit | { error: ApiErrorBody } | null> {
	const current = await getHabitIncludingDeleted(db, userId, habitId);
	if (!current) return null;
	const result = applyHabitDelete(current, now);
	if (result === "archived_required") return { error: ARCHIVED_REQUIRED_ERROR };
	if (!result.changed) return current;
	return writeDeletion(db, userId, result.habit);
}

/** Restores a deleted habit (`applyHabitRestore`); null if not the user's. */
export async function restoreHabit(
	db: Db,
	userId: string,
	habitId: string,
	now: number
): Promise<Habit | null> {
	const current = await getHabitIncludingDeleted(db, userId, habitId);
	if (!current) return null;
	const result = applyHabitRestore(current, now);
	if (!result.changed) return current;
	return writeDeletion(db, userId, result.habit);
}

/**
 * What a write carries: the fields of an update, or `deleted` for a deletion
 * or a restore (2.11.0).
 */
export type HabitFieldChanges = UpdateHabitRequest & { deleted?: boolean };

/** The columns an update writes: `updated_at` and the fields it carries. */
export function changedHabitFields(
	userId: string,
	next: Habit,
	changes: HabitFieldChanges
): Partial<typeof habits.$inferInsert> {
	const row = toHabitPatchRow(userId, next);
	return {
		updated_at: row.updated_at,
		...(changes.name !== undefined && { name: row.name }),
		...(changes.description !== undefined && {
			description: row.description,
		}),
		...(changes.schedule !== undefined && { schedule: row.schedule }),
		...(changes.archived !== undefined && { archived_at: row.archived_at }),
		...(changes.sort_key !== undefined && { sort_key: row.sort_key }),
		...(changes.deleted !== undefined && { deleted_at: row.deleted_at }),
	};
}
