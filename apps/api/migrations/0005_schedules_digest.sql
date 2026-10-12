-- 2.2.0: morning digest and notification preferences (additive).
-- drizzle-kit generated a rebuild of `reminder_state` to add a column with a
-- CHECK; SQLite accepts the CHECK on ADD COLUMN, so this stays additive (the
-- snapshot keeps the table-level form, which is equivalent).
ALTER TABLE `reminder_state` ADD `last_digest_date` text CONSTRAINT "reminder_state_last_digest_date_check" CHECK("last_digest_date" IS NULL OR date("last_digest_date") IS "last_digest_date");--> statement-breakpoint
ALTER TABLE `user_settings` ADD `morning_digest_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `show_titles_in_notifications` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- Reminder times move to 15-minute steps (the cron runs every 15 minutes):
-- round saved times down to the step ("20:07" -> "20:00", never past
-- midnight), like `roundDownToQuarter` in core.
UPDATE `user_settings`
SET
	`reminder_time` = substr(`reminder_time`, 1, 3) || printf('%02d', (CAST(substr(`reminder_time`, 4, 2) AS INTEGER) / 15) * 15),
	`updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE `reminder_time` IS NOT NULL
	AND substr(`reminder_time`, 4, 2) NOT IN ('00', '15', '30', '45');
