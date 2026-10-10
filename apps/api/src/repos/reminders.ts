// Reminder bookkeeping. The cron is a system job, so `listReminderCandidates`
// and `listDueTickets` read across users by design; every write is still
// scoped by the user it concerns.
import type { CalendarDate } from "@habits/contracts";
import { and, eq, exists, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
	pushSubscriptions,
	pushTickets,
	reminderState,
	userSettings,
} from "../db/schema.ts";

export interface ReminderCandidate {
	user_id: string;
	timezone: string;
	reminder_time: string;
	last_reminder_date: CalendarDate | null;
}

/** Users with reminders on and at least one device. */
export async function listReminderCandidates(
	db: Db
): Promise<ReminderCandidate[]> {
	const rows = await db
		.select({
			user_id: userSettings.user_id,
			timezone: userSettings.timezone,
			reminder_time: userSettings.reminder_time,
			last_reminder_date: reminderState.last_reminder_date,
		})
		.from(userSettings)
		.leftJoin(reminderState, eq(reminderState.user_id, userSettings.user_id))
		.where(
			and(
				isNotNull(userSettings.reminder_time),
				exists(
					db
						.select({ id: pushSubscriptions.id })
						.from(pushSubscriptions)
						.where(eq(pushSubscriptions.user_id, userSettings.user_id))
				)
			)
		)
		.orderBy(userSettings.user_id);
	return rows.flatMap((row) =>
		row.reminder_time === null
			? []
			: [{ ...row, reminder_time: row.reminder_time }]
	);
}

/**
 * Claims today's reminder for the user: true only for the first caller of
 * the day. Runs BEFORE sending, so overlapping or repeated cron runs cannot
 * send twice (a failed send loses that day's reminder instead).
 */
export async function claimReminderDay(
	db: Db,
	userId: string,
	today: CalendarDate,
	now: number
): Promise<boolean> {
	const claimed = await db
		.insert(reminderState)
		.values({ user_id: userId, last_reminder_date: today, updated_at: now })
		.onConflictDoUpdate({
			target: reminderState.user_id,
			set: { last_reminder_date: today, updated_at: now },
			setWhere: sql`${reminderState.last_reminder_date} IS NULL OR ${reminderState.last_reminder_date} < ${today}`,
		})
		.returning({ user_id: reminderState.user_id });
	return claimed.length > 0;
}

/**
 * Rate limit of `POST /v1/push/test`: true (and recorded) when the last test
 * was at least `intervalMs` ago. Atomic, so concurrent requests get one true.
 */
export async function claimTestPush(
	db: Db,
	userId: string,
	now: number,
	intervalMs: number
): Promise<boolean> {
	const claimed = await db
		.insert(reminderState)
		.values({ user_id: userId, last_test_push_at: now, updated_at: now })
		.onConflictDoUpdate({
			target: reminderState.user_id,
			set: { last_test_push_at: now, updated_at: now },
			setWhere: sql`${reminderState.last_test_push_at} IS NULL OR ${reminderState.last_test_push_at} <= ${now - intervalMs}`,
		})
		.returning({ user_id: reminderState.user_id });
	return claimed.length > 0;
}

export interface PendingTicket {
	id: string;
	user_id: string;
	subscription_id: string;
	created_at: number;
}

/** Expo tickets sent at or before `sentBefore`, oldest first. */
export function listDueTickets(
	db: Db,
	sentBefore: number,
	limit: number
): Promise<PendingTicket[]> {
	return db
		.select()
		.from(pushTickets)
		.where(lte(pushTickets.created_at, sentBefore))
		.orderBy(pushTickets.created_at)
		.limit(limit);
}

export async function deleteTickets(db: Db, ids: string[]): Promise<void> {
	// One parameter per id; D1 allows 100 per statement.
	for (let i = 0; i < ids.length; i += 100) {
		await db
			.delete(pushTickets)
			.where(inArray(pushTickets.id, ids.slice(i, i + 100)));
	}
}
