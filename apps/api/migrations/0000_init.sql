CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "completions_date_check" CHECK(date("completions"."date") IS "completions"."date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completions_habit_date_unique` ON `completions` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `completions_user_date_idx` ON `completions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `completions_user_updated_idx` ON `completions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`schedule` text NOT NULL,
	`start_date` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "habits_start_date_check" CHECK(date("habits"."start_date") IS "habits"."start_date"),
	CONSTRAINT "habits_schedule_check" CHECK(json_valid("habits"."schedule") AND json_type("habits"."schedule", '$.type') IS 'text')
);
--> statement-breakpoint
CREATE INDEX `habits_user_updated_idx` ON `habits` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
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
	CONSTRAINT "push_subscriptions_kind_check" CHECK(("push_subscriptions"."kind" = 'webpush' AND "push_subscriptions"."endpoint" IS NOT NULL AND "push_subscriptions"."p256dh" IS NOT NULL AND "push_subscriptions"."auth" IS NOT NULL AND "push_subscriptions"."token" IS NULL) OR ("push_subscriptions"."kind" = 'expo' AND "push_subscriptions"."token" IS NOT NULL AND "push_subscriptions"."endpoint" IS NULL AND "push_subscriptions"."p256dh" IS NULL AND "push_subscriptions"."auth" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_token_unique` ON `push_subscriptions` (`token`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`reminder_time` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "user_settings_reminder_time_check" CHECK("user_settings"."reminder_time" IS NULL OR ("user_settings"."reminder_time" GLOB '[0-2][0-9]:[0-5][0-9]' AND "user_settings"."reminder_time" < '24:00'))
);
