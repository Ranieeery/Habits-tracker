// `SqlDatabase` over expo-sqlite. Transactions use
// `withExclusiveTransactionAsync`: with the non-exclusive variant, any query
// running at the same time (a screen reading, the sync engine writing) would
// join the transaction.
import {
	deleteDatabaseAsync,
	openDatabaseAsync,
	type SQLiteDatabase,
} from "expo-sqlite";
import type { SqlDatabase, SqlExecutor, SqlValue } from "./sql.ts";

export const LOCAL_DATABASE_NAME = "habits.db";

type Queryable = Pick<
	SQLiteDatabase,
	"runAsync" | "getAllAsync" | "getFirstAsync"
>;

function executor(db: Queryable): SqlExecutor {
	const params = (values?: readonly SqlValue[]) => [...(values ?? [])];
	return {
		run: async (sql, values) => {
			await db.runAsync(sql, params(values));
		},
		all: (sql, values) => db.getAllAsync(sql, params(values)),
		first: (sql, values) => db.getFirstAsync(sql, params(values)),
	};
}

export async function openExpoDatabase(
	name = LOCAL_DATABASE_NAME
): Promise<SqlDatabase> {
	const db = await openDatabaseAsync(name);
	await db.execAsync("PRAGMA journal_mode = WAL;");
	return {
		...executor(db),
		exec: (sql) => db.execAsync(sql),
		async transaction(task) {
			let result: Awaited<ReturnType<typeof task>> | undefined;
			await db.withExclusiveTransactionAsync(async (txn) => {
				result = await task(executor(txn));
			});
			return result as Awaited<ReturnType<typeof task>>;
		},
		close: () => db.closeAsync(),
	};
}

export function deleteExpoDatabase(name = LOCAL_DATABASE_NAME): Promise<void> {
	return deleteDatabaseAsync(name);
}
