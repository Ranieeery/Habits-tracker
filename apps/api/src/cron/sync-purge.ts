// Daily purge of sync tombstones and applied mutation ids, run by the same
// Cron Trigger as the reminders. "Now" is the trigger's scheduled time.
import {
	PROCESSED_MUTATION_RETENTION_DAYS,
	TOMBSTONE_RETENTION_DAYS,
} from "@habits/core";
import type { Db } from "../db/client.ts";
import { listSyncUsers, purgeExpired } from "../repos/sync.ts";

const DAY_MS = 24 * 60 * 60_000;
const CRON_INTERVAL_MS = 15 * 60_000;

/**
 * Hour (UTC) of the one cron run per day that purges: 06:00 UTC is 03:00 in
 * São Paulo, away from usual reminder times, so the two jobs rarely share an
 * invocation's D1 budget.
 */
export const PURGE_HOUR_UTC = 6;

/** Each user is one batch of 4 statements (D1 Free: 50 queries per run). */
export const MAX_PURGE_USERS_PER_RUN = 8;

/** Whether `now` falls in the first cron run after `PURGE_HOUR_UTC`. */
export function isPurgeRun(now: number): boolean {
	const offset = (now - PURGE_HOUR_UTC * 60 * 60_000) % DAY_MS;
	return offset >= 0 && offset < CRON_INTERVAL_MS;
}

/** Retention is the same for tombstones and mutation ids (see core). */
const RETENTION_DAYS = Math.max(
	TOMBSTONE_RETENTION_DAYS,
	PROCESSED_MUTATION_RETENTION_DAYS
);

export async function runSyncPurge({
	db,
	now,
}: {
	db: Db;
	now: number;
}): Promise<{ usersPurged: number }> {
	if (!isPurgeRun(now)) return { usersPurged: 0 };
	const cutoff = now - RETENTION_DAYS * DAY_MS;
	const users = (await listSyncUsers(db)).slice(0, MAX_PURGE_USERS_PER_RUN);
	for (const userId of users) await purgeExpired(db, userId, cutoff);
	return { usersPurged: users.length };
}
