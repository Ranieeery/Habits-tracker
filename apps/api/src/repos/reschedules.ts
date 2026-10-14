// Postponed occurrences (2.16.0). Every statement is scoped by `userId`. The
// rules are core's (`checkReschedule`, `checkRescheduleUndo`), the same the
// sync push and both apps run.
import type {
	ApiErrorBody,
	CalendarDate,
	CreateRescheduleRequest,
	Habit,
	HabitReschedule,
} from "@habits/contracts";
import {
	checkReschedule,
	checkRescheduleUndo,
	newReschedule,
	occurrenceState,
	rescheduleBounds,
	rescheduleError,
	undoReschedule,
} from "@habits/core";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { fromRescheduleRow, toRescheduleRow } from "../db/records.ts";
import { completions, habitReschedules } from "../db/schema.ts";

/** The user's live postponements (one small query; never purged). */
export async function listLiveReschedules(
	db: Db,
	userId: string
): Promise<HabitReschedule[]> {
	const rows = await db
		.select()
		.from(habitReschedules)
		.where(
			and(
				eq(habitReschedules.user_id, userId),
				isNull(habitReschedules.deleted_at)
			)
		);
	return rows.map(fromRescheduleRow);
}

async function habitRows(
	db: Db,
	userId: string,
	habitId: string
): Promise<HabitReschedule[]> {
	const rows = await db
		.select()
		.from(habitReschedules)
		.where(
			and(
				eq(habitReschedules.user_id, userId),
				eq(habitReschedules.habit_id, habitId)
			)
		);
	return rows.map(fromRescheduleRow);
}

async function completedDates(
	db: Db,
	userId: string,
	habitId: string
): Promise<CalendarDate[]> {
	const rows = await db
		.select({ date: completions.date })
		.from(completions)
		.where(
			and(
				eq(completions.user_id, userId),
				eq(completions.habit_id, habitId),
				isNull(completions.deleted_at)
			)
		);
	return rows.map((row) => row.date);
}

export type RescheduleWrite =
	| { ok: true; reschedule: HabitReschedule; created: boolean }
	| { ok: false; error: ApiErrorBody };

/**
 * True for D1's unique constraint failure (the live index), also when
 * Drizzle wraps it (`cause`).
 */
function isUniqueViolation(error: unknown): boolean {
	for (let current = error, depth = 0; current && depth < 5; depth++) {
		const message = (current as { message?: unknown }).message;
		if (
			typeof message === "string" &&
			/UNIQUE constraint failed/i.test(message)
		)
			return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}

/**
 * Postpones one occurrence of the user's habit (checked with core against
 * `today`). Idempotent per id. Two concurrent requests for the same
 * occurrence cannot both write: the live unique index refuses the second,
 * answered as `conflict`.
 */
export async function createReschedule(
	db: Db,
	userId: string,
	habit: Habit,
	request: CreateRescheduleRequest,
	today: CalendarDate,
	now: number
): Promise<RescheduleWrite> {
	const [rows, dates] = await Promise.all([
		habitRows(db, userId, habit.id),
		completedDates(db, userId, habit.id),
	]);
	const existing = rows.find((row) => row.id === request.id);
	if (existing) return { ok: true, reschedule: existing, created: false };
	const problem = checkReschedule({
		habit,
		rows,
		completedDates: dates,
		request,
		today,
	});
	if (problem) {
		const bounds = rescheduleBounds(
			habit,
			occurrenceState(rows, habit.id, request.original_date),
			today
		);
		return { ok: false, error: rescheduleError(problem, bounds) };
	}
	const row = newReschedule({ ...request, habit_id: habit.id }, now);
	try {
		const [inserted] = await db
			.insert(habitReschedules)
			.values(toRescheduleRow(userId, row))
			.onConflictDoNothing({ target: habitReschedules.id })
			.returning();
		if (!inserted) {
			return {
				ok: false,
				error: { code: "conflict", message: "Reschedule id already in use" },
			};
		}
		return { ok: true, reschedule: fromRescheduleRow(inserted), created: true };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, error: rescheduleError("stale") };
		}
		throw error;
	}
}

/**
 * Undoes the last postponement of an occurrence (a tombstone); undoing an
 * undone one changes nothing. Null when the row is not this habit's.
 */
export async function undoRescheduleRow(
	db: Db,
	userId: string,
	habit: Habit,
	rescheduleId: string,
	today: CalendarDate,
	now: number
): Promise<RescheduleWrite | null> {
	const rows = await habitRows(db, userId, habit.id);
	const row = rows.find((candidate) => candidate.id === rescheduleId);
	if (!row) return null;
	if (row.deleted_at !== null) {
		return { ok: true, reschedule: row, created: false };
	}
	const problem = checkRescheduleUndo({ habit, rows, row, today });
	if (problem) return { ok: false, error: rescheduleError(problem) };
	const undone = undoReschedule(row, now).row;
	const [updated] = await db
		.update(habitReschedules)
		.set({ deleted_at: undone.deleted_at, updated_at: undone.updated_at })
		.where(
			and(
				eq(habitReschedules.user_id, userId),
				eq(habitReschedules.id, row.id),
				isNull(habitReschedules.deleted_at)
			)
		)
		.returning();
	return {
		ok: true,
		reschedule: updated ? fromRescheduleRow(updated) : undone,
		created: false,
	};
}
