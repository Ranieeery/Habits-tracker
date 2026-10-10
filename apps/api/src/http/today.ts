import { todayIn } from "@habits/core";
import type { Context } from "hono";
import { ensureSettings } from "../repos/settings.ts";
import type { AppEnv } from "./context.ts";

/**
 * The user's local calendar day and time zone, from `user_settings.timezone`
 * and the injected clock (never the server's own day).
 */
export async function userToday(c: Context<AppEnv>) {
	const now = c.var.now();
	const settings = await ensureSettings(c.var.db, c.var.userId, now);
	return {
		now,
		timeZone: settings.timezone,
		today: todayIn(settings.timezone, now),
	};
}
