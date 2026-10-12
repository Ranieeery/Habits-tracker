import { z } from "zod";
import { TimeZone, TimestampMs } from "./primitives.ts";

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/**
 * Local wall-clock time, `HH:MM` (24h), in 15-minute steps (`:00`, `:15`,
 * `:30`, `:45`): the reminder cron runs every 15 minutes. Values saved before
 * 2.2.0 were rounded down to the step by migration `0005`.
 */
export const ReminderTime = z
	.string()
	.regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, {
		message: "Expected HH:MM in 15-minute steps",
	});
export type ReminderTime = z.infer<typeof ReminderTime>;

/** Per-user preferences. One record per user. */
export const UserSettings = z.object({
	/** IANA time zone that defines the user's calendar days. */
	timezone: TimeZone,
	/** Daily reminder time in `timezone`; `null` turns reminders off. */
	reminder_time: ReminderTime.nullable(),
	/**
	 * Morning digest at the fixed `MORNING_DIGEST_TIME` (core). Defaults to on;
	 * the default also covers copies stored by clients older than 2.2.0.
	 */
	morning_digest_enabled: z.boolean().default(true),
	/** Habit names in notification texts (off: generic texts only). */
	show_titles_in_notifications: z.boolean().default(true),
	created_at: TimestampMs,
	updated_at: TimestampMs,
});
export type UserSettings = z.infer<typeof UserSettings>;

export const UpdateUserSettingsRequest = z
	.object({
		timezone: TimeZone,
		reminder_time: ReminderTime.nullable(),
		morning_digest_enabled: z.boolean(),
		show_titles_in_notifications: z.boolean(),
	})
	.partial();
export type UpdateUserSettingsRequest = z.infer<
	typeof UpdateUserSettingsRequest
>;

export const UserSettingsResponse = z.object({ settings: UserSettings });
export type UserSettingsResponse = z.infer<typeof UserSettingsResponse>;
