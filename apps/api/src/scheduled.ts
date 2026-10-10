// Cron Trigger entry (`triggers.crons` in wrangler.jsonc, every 15 minutes).
import { readConfig } from "./config.ts";
import { runReminderJob } from "./cron/reminders.ts";
import { createDb } from "./db/client.ts";

export interface ScheduledDeps {
	env: Env;
	/** The trigger's scheduled time (UTC ms): the job's "now". */
	now: number;
	/** Outgoing requests to push services (tests pass a fake). */
	fetch: typeof fetch;
}

export async function runScheduled({ env, now, fetch }: ScheduledDeps) {
	const config = readConfig(env);
	if (!config.vapid) {
		console.warn("reminders: VAPID keys not set, web devices are skipped");
	}
	const report = await runReminderJob({
		db: createDb(env.DB),
		fetch,
		now,
		config,
	});
	// Counts only: never endpoints, keys or tokens.
	console.log("reminders", JSON.stringify(report));
	return report;
}
