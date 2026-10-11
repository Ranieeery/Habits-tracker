CREATE TABLE `processed_mutations` (
	`user_id` text NOT NULL,
	`mutation_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`processed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `mutation_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `processed_mutations_processed_idx` ON `processed_mutations` (`processed_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`purged_seq` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `completions` ADD `server_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `completions_user_seq_idx` ON `completions` (`user_id`,`server_seq`);--> statement-breakpoint
ALTER TABLE `habits` ADD `server_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `habits_user_seq_idx` ON `habits` (`user_id`,`server_seq`);--> statement-breakpoint
-- Hand-written below (drizzle-kit does not model data backfills or triggers).
-- Backfill: number every existing row per user in write order (habits before
-- completions on ties), so the first pull of each device gets everything.
UPDATE `habits` SET `server_seq` = `numbered`.`seq`
FROM (
	SELECT `kind`, `id`, ROW_NUMBER() OVER (PARTITION BY `user_id` ORDER BY `updated_at`, `kind`, `id`) AS `seq`
	FROM (
		SELECT 0 AS `kind`, `id`, `user_id`, `updated_at` FROM `habits`
		UNION ALL
		SELECT 1 AS `kind`, `id`, `user_id`, `updated_at` FROM `completions`
	)
) AS `numbered`
WHERE `numbered`.`kind` = 0 AND `numbered`.`id` = `habits`.`id`;--> statement-breakpoint
UPDATE `completions` SET `server_seq` = `numbered`.`seq`
FROM (
	SELECT `kind`, `id`, ROW_NUMBER() OVER (PARTITION BY `user_id` ORDER BY `updated_at`, `kind`, `id`) AS `seq`
	FROM (
		SELECT 0 AS `kind`, `id`, `user_id`, `updated_at` FROM `habits`
		UNION ALL
		SELECT 1 AS `kind`, `id`, `user_id`, `updated_at` FROM `completions`
	)
) AS `numbered`
WHERE `numbered`.`kind` = 1 AND `numbered`.`id` = `completions`.`id`;--> statement-breakpoint
INSERT INTO `sync_state` (`user_id`, `seq`)
SELECT `user_id`, COUNT(*) FROM (
	SELECT `user_id` FROM `habits`
	UNION ALL
	SELECT `user_id` FROM `completions`
)
GROUP BY `user_id`;--> statement-breakpoint
-- Every insert or update of a habit or completion takes the user's next seq.
-- `UPDATE OF` lists every column but `server_seq`, so the trigger's own update
-- never fires it again. The sync_state row is created with NOT EXISTS, not
-- INSERT OR IGNORE: an outer statement's conflict clause (e.g. an upsert)
-- overrides the conflict policy of statements inside a trigger.
CREATE TRIGGER `habits_server_seq_insert` AFTER INSERT ON `habits`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `habits` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;--> statement-breakpoint
CREATE TRIGGER `habits_server_seq_update` AFTER UPDATE OF `id`, `user_id`, `name`, `schedule`, `start_date`, `archived_at`, `created_at`, `updated_at`, `deleted_at` ON `habits`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `habits` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;--> statement-breakpoint
CREATE TRIGGER `completions_server_seq_insert` AFTER INSERT ON `completions`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `completions` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;--> statement-breakpoint
CREATE TRIGGER `completions_server_seq_update` AFTER UPDATE OF `id`, `user_id`, `habit_id`, `date`, `completed_at`, `created_at`, `updated_at`, `deleted_at` ON `completions`
BEGIN
	INSERT INTO `sync_state` (`user_id`) SELECT NEW.`user_id` WHERE NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `user_id` = NEW.`user_id`);
	UPDATE `sync_state` SET `seq` = `seq` + 1 WHERE `user_id` = NEW.`user_id`;
	UPDATE `completions` SET `server_seq` = (SELECT `seq` FROM `sync_state` WHERE `user_id` = NEW.`user_id`) WHERE `rowid` = NEW.`rowid`;
END;
