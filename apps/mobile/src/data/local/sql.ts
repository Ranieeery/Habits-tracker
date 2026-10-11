// The small slice of SQLite the local store needs. Implemented over
// expo-sqlite in the app (`expo-sql.ts`) and over Node's built-in `node:sqlite`
// in tests (`testing/node-sql.ts`), so the store's real SQL runs under Vitest.

export type SqlValue = string | number | null;

export interface SqlExecutor {
	run(sql: string, params?: readonly SqlValue[]): Promise<void>;
	all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
	first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
}

export interface SqlDatabase extends SqlExecutor {
	/** Several statements, no parameters (migrations). */
	exec(sql: string): Promise<void>;
	/**
	 * Runs `task` in an exclusive transaction: only the statements made
	 * through `tx` belong to it, and it rolls back if `task` throws.
	 */
	transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
	close(): Promise<void>;
}
