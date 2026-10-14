CREATE TABLE `habit_reschedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`original_date` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`sequence` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_seq` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "habit_reschedules_dates_check" CHECK(date("habit_reschedules"."original_date") IS "habit_reschedules"."original_date" AND date("habit_reschedules"."from_date") IS "habit_reschedules"."from_date" AND date("habit_reschedules"."to_date") IS "habit_reschedules"."to_date" AND "habit_reschedules"."to_date" > "habit_reschedules"."from_date"),
	CONSTRAINT "habit_reschedules_sequence_check" CHECK("habit_reschedules"."sequence" >= 1)
);
--> statement-breakpoint
CREATE INDEX `habit_reschedules_user_habit_idx` ON `habit_reschedules` (`user_id`,`habit_id`);--> statement-breakpoint
CREATE INDEX `habit_reschedules_user_seq_idx` ON `habit_reschedules` (`user_id`,`server_seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `habit_reschedules_live_unique` ON `habit_reschedules` (`habit_id`,`original_date`,`sequence`) WHERE "habit_reschedules"."deleted_at" IS NULL;--> statement-breakpoint
-- Hand-written below (drizzle-kit does not model triggers): every insert or
-- update takes the user's next seq, like habits and completions (0004_sync).
-- `UPDATE OF` lists every column but `server_seq`; a column added later must
-- also set `updated_at` when written.
CREATE TRIGGER `habit_reschedules_server_seq_insert` AFTER INSERT ON `habit_reschedules`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `habit_reschedules` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;--> statement-breakpoint
CREATE TRIGGER `habit_reschedules_server_seq_update` AFTER UPDATE OF `id`, `user_id`, `habit_id`, `original_date`, `from_date`, `to_date`, `sequence`, `created_at`, `updated_at`, `deleted_at` ON `habit_reschedules`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `habit_reschedules` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;
