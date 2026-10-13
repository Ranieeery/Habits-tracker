-- 2.12.0: optional habit description (additive). Existing habits get ''
-- (none), so nothing needs to reach devices: no `updated_at` bump. The
-- `server_seq` update trigger of 0004 does not list this column; app writes
-- of `description` always set `updated_at` too (`changedHabitFields`). The
-- 5000-character limit is the contract's (`records.ts` parses every write).
ALTER TABLE `habits` ADD `description` text DEFAULT '' NOT NULL;
