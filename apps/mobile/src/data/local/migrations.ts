// Versioned schema of the local database, tracked with `PRAGMA user_version`
// (the pattern the expo-sqlite docs show). Append new versions; never edit a
// shipped one.
//
// `habits` and `completions` mirror the server: only pulls write them. What
// the user does goes to `outbox` and is replayed over the mirror when reading
// (`materialize` in @habits/core), so a rejected change disappears from the
// screen on its own once it stops being pending.
import type { SqlDatabase } from "./sql.ts";

export const MIGRATIONS: readonly string[] = [
	// 1
	`
	CREATE TABLE habits (
		id TEXT PRIMARY KEY NOT NULL,
		name TEXT NOT NULL,
		schedule TEXT NOT NULL,
		start_date TEXT NOT NULL,
		archived_at INTEGER,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted_at INTEGER
	);
	CREATE TABLE completions (
		id TEXT PRIMARY KEY NOT NULL,
		habit_id TEXT NOT NULL,
		date TEXT NOT NULL,
		completed_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted_at INTEGER,
		UNIQUE (habit_id, date)
	);
	CREATE INDEX completions_date_idx ON completions (date);
	CREATE TABLE outbox (
		seq INTEGER PRIMARY KEY AUTOINCREMENT,
		mutation_id TEXT NOT NULL UNIQUE,
		type TEXT NOT NULL,
		habit_id TEXT,
		payload TEXT NOT NULL,
		-- pending: to send. applied: accepted by the server, kept (and replayed)
		-- until a full pull brings the server's version. failed: rejected for
		-- good, shown to the user until retried or discarded.
		state TEXT NOT NULL DEFAULT 'pending'
			CHECK (state IN ('pending', 'applied', 'failed')),
		attempts INTEGER NOT NULL DEFAULT 0,
		last_error TEXT,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE meta (
		key TEXT PRIMARY KEY NOT NULL,
		value TEXT NOT NULL
	);
	`,
	// 2 (2.4.0): the user's order of habits. Rows mirrored before it keep ''
	// (sorted last) until the next pull, which brings the keys the server
	// filled in (its migration 0006 moved every habit's sync cursor).
	`
	ALTER TABLE habits ADD COLUMN sort_key TEXT NOT NULL DEFAULT '';
	`,
	// 3 (2.12.0): the habit description. No habit had one before, so rows
	// mirrored earlier are right with '' (no pull needed).
	`
	ALTER TABLE habits ADD COLUMN description TEXT NOT NULL DEFAULT '';
	`,
	// 4 (2.16.0): postponed occurrences, mirrored like habits and completions.
	// Rows the server already had are behind the cursor: the engine pulls
	// everything again once (`mirror_version`).
	`
	CREATE TABLE reschedules (
		id TEXT PRIMARY KEY NOT NULL,
		habit_id TEXT NOT NULL,
		original_date TEXT NOT NULL,
		from_date TEXT NOT NULL,
		to_date TEXT NOT NULL,
		sequence INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted_at INTEGER
	);
	CREATE INDEX reschedules_habit_idx ON reschedules (habit_id);
	`,
];

export async function migrate(db: SqlDatabase): Promise<number> {
	const row = await db.first<{ user_version: number }>("PRAGMA user_version");
	const current = row?.user_version ?? 0;
	for (let version = current + 1; version <= MIGRATIONS.length; version++) {
		try {
			await db.exec(
				`BEGIN; ${MIGRATIONS[version - 1]} PRAGMA user_version = ${version}; COMMIT;`
			);
		} catch (error) {
			await db.exec("ROLLBACK;").catch(() => undefined);
			throw error;
		}
	}
	return MIGRATIONS.length;
}
