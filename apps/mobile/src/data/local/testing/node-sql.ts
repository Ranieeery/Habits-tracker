// `SqlDatabase` over Node's built-in SQLite, for Vitest: the store's real SQL
// runs against an in-memory database. Never imported by the app.
import { DatabaseSync } from "node:sqlite";
import type { SqlDatabase, SqlExecutor, SqlValue } from "../sql.ts";

export function openNodeDatabase(): SqlDatabase {
	const db = new DatabaseSync(":memory:");
	const executor: SqlExecutor = {
		run: async (sql, params = []) => {
			db.prepare(sql).run(...(params as SqlValue[]));
		},
		all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
			db.prepare(sql).all(...params) as T[],
		first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
			(db.prepare(sql).get(...params) as T | undefined) ?? null,
	};
	// Exclusive like expo-sqlite's: a second transaction waits for the first.
	let queue: Promise<unknown> = Promise.resolve();
	return {
		...executor,
		exec: async (sql) => db.exec(sql),
		transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T> {
			const run = queue.then(async () => {
				db.exec("BEGIN");
				try {
					const result = await task(executor);
					db.exec("COMMIT");
					return result;
				} catch (error) {
					db.exec("ROLLBACK");
					throw error;
				}
			});
			queue = run.catch(() => undefined);
			return run;
		},
		close: async () => db.close(),
	};
}
