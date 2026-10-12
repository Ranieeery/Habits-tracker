import {
	type Habit,
	SCHEDULE_VERSION,
	SCHEDULE_VERSION_HEADER,
	scheduleVersionOf,
} from "@habits/contracts";
import type { Context } from "hono";
import type { AppEnv } from "./context.ts";

/**
 * The highest schedule version the client understands, from
 * `X-Habits-Schedule-Version` (sent by `@habits/api-client` since 2.2.0).
 * Clients without it are the 2.1.0 apps: version 1 (weekdays only). Values
 * above this server's version are capped to it.
 */
export function clientScheduleVersion(c: Context<AppEnv>): number {
	const raw = c.req.header(SCHEDULE_VERSION_HEADER);
	const parsed =
		raw !== undefined && /^\d+$/.test(raw.trim()) ? Number(raw) : 1;
	return Math.max(1, Math.min(parsed, SCHEDULE_VERSION));
}

/**
 * Whether a client of `version` can read the habit. Older clients parse the
 * schedule union strictly (the 2.1.0 app stops syncing on an unknown type),
 * so `GET /v1/habits` and `GET /v1/sync/pull` leave such habits out for them.
 */
export function isReadableBy(habit: Pick<Habit, "schedule">, version: number) {
	return scheduleVersionOf(habit.schedule) <= version;
}
