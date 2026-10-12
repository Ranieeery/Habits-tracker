-- 2.4.0: user-defined order of habits (additive). `sort_key` is a fractional
-- index compared as text (core `sort-key.ts`); empty sorts last.
ALTER TABLE `habits` ADD `sort_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Existing habits keep their order (creation, then id), per user, as the
-- first keys of core's scheme: a0 ... az (62 keys), then b00 ... bzz (3844).
-- A user with more habits than that keeps '' for the rest (sorted last, by
-- creation). The `server_seq` update trigger of 0004 lists its columns
-- (`AFTER UPDATE OF … updated_at …`) and does not know `sort_key`:
-- `updated_at` = itself puts a listed column in the SET, so the trigger fires
-- (SQLite checks the SET list, not whether the value changed) and every
-- device gets the keys on its next pull. App writes of `sort_key` always set
-- `updated_at` too (`changedHabitFields`).
UPDATE `habits`
SET `updated_at` = `updated_at`, `sort_key` = CASE
	WHEN `ranked`.`rn` < 62 THEN 'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', `ranked`.`rn` + 1, 1)
	ELSE 'b'
		|| substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (`ranked`.`rn` - 62) / 62 + 1, 1)
		|| substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (`ranked`.`rn` - 62) % 62 + 1, 1)
END
FROM (
	SELECT `id`, row_number() OVER (PARTITION BY `user_id` ORDER BY `created_at`, `id`) - 1 AS `rn`
	FROM `habits`
) AS `ranked`
WHERE `ranked`.`id` = `habits`.`id` AND `ranked`.`rn` < 3906;
