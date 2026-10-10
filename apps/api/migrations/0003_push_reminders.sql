CREATE TABLE `push_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_tickets_created_idx` ON `push_tickets` (`created_at`);--> statement-breakpoint
CREATE TABLE `reminder_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_reminder_date` text,
	`last_test_push_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reminder_state_last_reminder_date_check" CHECK("reminder_state"."last_reminder_date" IS NULL OR date("reminder_state"."last_reminder_date") IS "reminder_state"."last_reminder_date")
);
