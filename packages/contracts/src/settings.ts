import { z } from "zod";
import { TimeZone, TimestampMs } from "./primitives.ts";

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/** Local wall-clock time, `HH:MM` (24h). */
export const ReminderTime = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Expected HH:MM" });
export type ReminderTime = z.infer<typeof ReminderTime>;

/** Per-user preferences. One record per user. */
export const UserSettings = z.object({
	/** IANA time zone that defines the user's calendar days. */
	timezone: TimeZone,
	/** Daily reminder time in `timezone`; `null` turns reminders off. */
	reminder_time: ReminderTime.nullable(),
	created_at: TimestampMs,
	updated_at: TimestampMs,
});
export type UserSettings = z.infer<typeof UserSettings>;
