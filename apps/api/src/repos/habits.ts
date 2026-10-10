import type { Habit, UpdateHabitRequest } from "@habits/contracts";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { fromHabitRow, toHabitRow } from "../db/records.ts";
import { habits } from "../db/schema.ts";

const ownedBy = (userId: string) =>
	and(eq(habits.user_id, userId), isNull(habits.deleted_at));

/** The user's habits that are not deleted (archived ones included). */
export async function listHabits(db: Db, userId: string): Promise<Habit[]> {
	const rows = await db
		.select()
		.from(habits)
		.where(ownedBy(userId))
		.orderBy(asc(habits.created_at), asc(habits.id));
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

/** Applies the changes; null if the habit is not the user's. */
export async function updateHabit(
	db: Db,
	userId: string,
	habitId: string,
	changes: UpdateHabitRequest,
	now: number
): Promise<Habit | null> {
	const current = await getHabit(db, userId, habitId);
	if (!current) return null;
	const { archived, ...fields } = changes;
	let archived_at = current.archived_at;
	if (archived === true) archived_at ??= now;
	if (archived === false) archived_at = null;
	const next = toHabitRow(userId, {
		...current,
		...fields,
		archived_at,
		updated_at: now,
	});
	const [row] = await db
		.update(habits)
		.set(next)
		.where(and(ownedBy(userId), eq(habits.id, habitId)))
		.returning();
	return row ? fromHabitRow(row) : null;
}
