-- Row counts per table plus the sync triggers, to compare a database with a
-- backup or a restore (README.md, "Backup e restauração"). Reads only. One
-- SELECT per table: D1 caps the terms of a compound SELECT.
--   pnpm --filter api exec wrangler d1 execute DB --local --file scripts/row-counts.sql
--   pnpm --filter api exec wrangler d1 execute DB --remote --file scripts/row-counts.sql
SELECT 'user' AS tbl, count(*) AS n FROM `user`;
SELECT 'session' AS tbl, count(*) AS n FROM `session`;
SELECT 'account' AS tbl, count(*) AS n FROM `account`;
SELECT 'verification' AS tbl, count(*) AS n FROM `verification`;
SELECT 'rate_limit' AS tbl, count(*) AS n FROM `rate_limit`;
SELECT 'habits' AS tbl, count(*) AS n FROM `habits`;
SELECT 'completions' AS tbl, count(*) AS n FROM `completions`;
SELECT 'user_settings' AS tbl, count(*) AS n FROM `user_settings`;
SELECT 'push_subscriptions' AS tbl, count(*) AS n FROM `push_subscriptions`;
SELECT 'reminder_state' AS tbl, count(*) AS n FROM `reminder_state`;
SELECT 'push_tickets' AS tbl, count(*) AS n FROM `push_tickets`;
SELECT 'sync_state' AS tbl, count(*) AS n FROM `sync_state`;
SELECT 'processed_mutations' AS tbl, count(*) AS n FROM `processed_mutations`;
SELECT 'd1_migrations' AS tbl, count(*) AS n FROM `d1_migrations`;
SELECT 'triggers' AS tbl, count(*) AS n FROM sqlite_master WHERE type = 'trigger';
SELECT 'max_server_seq' AS tbl, max(seq) AS n FROM `sync_state`;
