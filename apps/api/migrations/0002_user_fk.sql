-- Adds user_id -> user.id (ON DELETE CASCADE) to every domain table by
-- rebuilding the tables. Edited by hand after drizzle-kit generate: D1 always
-- enforces foreign keys and ignores PRAGMA foreign_keys, so the rebuild defers
-- the checks to the end of the migration instead.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
-- Rows of users that do not exist cannot satisfy the new keys. Only local dev
-- databases have them (seeded before auth existed): re-run db:seed:local.
DELETE FROM `completions` WHERE `user_id` NOT IN (SELECT `id` FROM `user`);--> statement-breakpoint
DELETE FROM `habits` WHERE `user_id` NOT IN (SELECT `id` FROM `user`);--> statement-breakpoint
DELETE FROM `push_subscriptions` WHERE `user_id` NOT IN (SELECT `id` FROM `user`);--> statement-breakpoint
DELETE FROM `user_settings` WHERE `user_id` NOT IN (SELECT `id` FROM `user`);--> statement-breakpoint
CREATE TABLE `__new_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "completions_date_check" CHECK(date("__new_completions"."date") IS "__new_completions"."date")
);
--> statement-breakpoint
INSERT INTO `__new_completions`("id", "user_id", "habit_id", "date", "completed_at", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "habit_id", "date", "completed_at", "created_at", "updated_at", "deleted_at" FROM `completions`;--> statement-breakpoint
DROP TABLE `completions`;--> statement-breakpoint
ALTER TABLE `__new_completions` RENAME TO `completions`;--> statement-breakpoint
CREATE UNIQUE INDEX `completions_habit_date_unique` ON `completions` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `completions_user_date_idx` ON `completions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `completions_user_updated_idx` ON `completions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`schedule` text NOT NULL,
	`start_date` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "habits_start_date_check" CHECK(date("__new_habits"."start_date") IS "__new_habits"."start_date"),
	CONSTRAINT "habits_schedule_check" CHECK(json_valid("__new_habits"."schedule") AND json_type("__new_habits"."schedule", '$.type') IS 'text')
);
--> statement-breakpoint
INSERT INTO `__new_habits`("id", "user_id", "name", "schedule", "start_date", "archived_at", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "name", "schedule", "start_date", "archived_at", "created_at", "updated_at", "deleted_at" FROM `habits`;--> statement-breakpoint
DROP TABLE `habits`;--> statement-breakpoint
ALTER TABLE `__new_habits` RENAME TO `habits`;--> statement-breakpoint
CREATE INDEX `habits_user_updated_idx` ON `habits` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`endpoint` text,
	`p256dh` text,
	`auth` text,
	`token` text,
	`device_label` text,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "push_subscriptions_kind_check" CHECK(("__new_push_subscriptions"."kind" = 'webpush' AND "__new_push_subscriptions"."endpoint" IS NOT NULL AND "__new_push_subscriptions"."p256dh" IS NOT NULL AND "__new_push_subscriptions"."auth" IS NOT NULL AND "__new_push_subscriptions"."token" IS NULL) OR ("__new_push_subscriptions"."kind" = 'expo' AND "__new_push_subscriptions"."token" IS NOT NULL AND "__new_push_subscriptions"."endpoint" IS NULL AND "__new_push_subscriptions"."p256dh" IS NULL AND "__new_push_subscriptions"."auth" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_push_subscriptions`("id", "user_id", "kind", "endpoint", "p256dh", "auth", "token", "device_label", "last_seen_at", "created_at", "updated_at") SELECT "id", "user_id", "kind", "endpoint", "p256dh", "auth", "token", "device_label", "last_seen_at", "created_at", "updated_at" FROM `push_subscriptions`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_push_subscriptions` RENAME TO `push_subscriptions`;--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_token_unique` ON `push_subscriptions` (`token`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`reminder_time` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_settings_reminder_time_check" CHECK("__new_user_settings"."reminder_time" IS NULL OR ("__new_user_settings"."reminder_time" GLOB '[0-2][0-9]:[0-5][0-9]' AND "__new_user_settings"."reminder_time" < '24:00'))
);
--> statement-breakpoint
INSERT INTO `__new_user_settings`("user_id", "timezone", "reminder_time", "created_at", "updated_at") SELECT "user_id", "timezone", "reminder_time", "created_at", "updated_at" FROM `user_settings`;--> statement-breakpoint
DROP TABLE `user_settings`;--> statement-breakpoint
ALTER TABLE `__new_user_settings` RENAME TO `user_settings`;