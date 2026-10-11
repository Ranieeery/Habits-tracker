// The part of Node's built-in `node:sqlite` (Node >= 22.13) the tests use.
// The app has no @types/node (React Native globals would clash), so it is
// declared here; only `testing/node-sql.ts` imports it, and only Vitest runs it.
declare module "node:sqlite" {
	type Value = string | number | bigint | null | Uint8Array;

	interface StatementSync {
		run(...params: Value[]): unknown;
		all(...params: Value[]): unknown[];
		get(...params: Value[]): unknown;
	}

	export class DatabaseSync {
		constructor(path: string);
		exec(sql: string): void;
		prepare(sql: string): StatementSync;
		close(): void;
	}
}
