// Cron Trigger entry (`triggers.crons` in wrangler.jsonc, every 15 minutes).
import { readConfig } from "./config.ts";
import { runReminderJob } from "./cron/reminders.ts";
import { runSyncPurge } from "./cron/sync-purge.ts";
import { createDb } from "./db/client.ts";
import { errorName, log } from "./lib/log.ts";

export interface ScheduledDeps {
	env: Env;
	/** The trigger's scheduled time (UTC ms): the job's "now". */
	now: number;
	/** Outgoing requests to push services (tests pass a fake). */
	fetch: typeof fetch;
}

export async function runScheduled({ env, now, fetch }: ScheduledDeps) {
	try {
		const config = readConfig(env);
		if (!config.vapid) log.warn("vapid_not_configured");
		const db = createDb(env.DB);
		const report = await runReminderJob({ db, fetch, now, config });
		// Counts only: never endpoints, keys or tokens.
		log.info("cron_reminders", { ...report });
		const purge = await runSyncPurge({ db, now });
		if (purge.usersPurged > 0) log.info("cron_sync_purge", { ...purge });
		return report;
	} catch (error) {
		// Rethrown so the invocation shows as an exception in Workers Logs.
		log.error("cron_failed", { error: errorName(error) });
		throw error;
	}
}
