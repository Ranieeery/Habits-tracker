import type { CalendarDate, Completion } from "@habits/contracts";
import { applyCompletionSet } from "@habits/core";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { fromCompletionRow, toCompletionRow } from "../db/records.ts";
import { completions, habits } from "../db/schema.ts";

async function findCompletion(
	db: Db,
	userId: string,
	habitId: string,
	date: CalendarDate
): Promise<Completion | null> {
	const row = await db.query.completions.findFirst({
		where: and(
			eq(completions.user_id, userId),
			eq(completions.habit_id, habitId),
			eq(completions.date, date)
		),
	});
	return row ? fromCompletionRow(row) : null;
}

export interface SetCompletionInput {
	habitId: string;
	date: CalendarDate;
	completed: boolean;
	/** Id for a new row; an existing `(habit_id, date)` row keeps its own. */
	id: string;
}

/**
 * Marks the habit done or undone on the date (rules in `applyCompletionSet`,
 * shared with sync). Idempotent: setting the current state changes nothing.
 * Undoing writes a tombstone (`deleted_at`) instead of deleting, creating one
 * if no row exists, so the change can sync. The caller must have checked that
 * the habit belongs to the user. Returns null when the new id is already
 * taken by another record.
 */
export async function setCompletion(
	db: Db,
	userId: string,
	{ habitId, date, completed, id }: SetCompletionInput,
	now: number
): Promise<Completion | null> {
	const input = { id, habit_id: habitId, date, completed };
	let current = await findCompletion(db, userId, habitId, date);
	if (!current) {
		const { completion } = applyCompletionSet(null, input, now);
		const [inserted] = await db
			.insert(completions)
			.values(toCompletionRow(userId, completion))
			.onConflictDoNothing()
			.returning();
		if (inserted) return fromCompletionRow(inserted);
		// Either a concurrent request created the row, or `id` is taken.
		current = await findCompletion(db, userId, habitId, date);
		if (!current) return null;
	}

	const result = applyCompletionSet(current, input, now);
	if (!result.changed) return current;
	const [row] = await db
		.update(completions)
		.set(toCompletionRow(userId, result.completion))
		.where(and(eq(completions.user_id, userId), eq(completions.id, current.id)))
		.returning();
	return fromCompletionRow(row!);
}

/** First live completion of each deadline task of the user (2.13.0). */
export async function listDeadlineFirsts(
	db: Db,
	userId: string
): Promise<{ habit_id: string; date: CalendarDate }[]> {
	return db
		.select({
			habit_id: completions.habit_id,
			date: sql<CalendarDate>`min(${completions.date})`,
		})
		.from(completions)
		.innerJoin(habits, eq(habits.id, completions.habit_id))
		.where(
			and(
				eq(completions.user_id, userId),
				eq(habits.user_id, userId),
				isNull(completions.deleted_at),
				sql`json_extract(${habits.schedule}, '$.type') = 'deadline'`
			)
		)
		.groupBy(completions.habit_id);
}

/**
 * Live (not un-checked) completions of the user between two dates, plus every
 * live completion of the user's deadline tasks (2.13.0): they count through
 * their first completion, which may be outside the range. Still one
 * statement; users without deadline tasks read the same rows as before.
 */
export async function listLiveCompletions(
	db: Db,
	userId: string,
	from: CalendarDate,
	to: CalendarDate
): Promise<Pick<Completion, "habit_id" | "date" | "deleted_at">[]> {
	return db
		.select({
			habit_id: completions.habit_id,
			date: completions.date,
			deleted_at: completions.deleted_at,
		})
		.from(completions)
		.where(
			and(
				eq(completions.user_id, userId),
				isNull(completions.deleted_at),
				or(
					and(gte(completions.date, from), lte(completions.date, to)),
					inArray(
						completions.habit_id,
						db
							.select({ id: habits.id })
							.from(habits)
							.where(
								and(
									eq(habits.user_id, userId),
									sql`json_extract(${habits.schedule}, '$.type') = 'deadline'`
								)
							)
					)
				)
			)
		)
		.orderBy(asc(completions.date));
}
