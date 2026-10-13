// `SqlDatabase` over expo-sqlite. Transactions use
// `withExclusiveTransactionAsync`: with the non-exclusive variant, any query
// running at the same time (a screen reading, the sync engine writing) would
// join the transaction. Each exclusive transaction gets its own connection, so
// they run one at a time per JS context (`createSerialQueue`), and a busy
// timeout covers the background task's separate context.
import {
	deleteDatabaseAsync,
	openDatabaseAsync,
	type SQLiteDatabase,
} from "expo-sqlite";
import { createSerialQueue } from "./serial.ts";
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
	await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
	const serial = createSerialQueue();
	return {
		...executor(db),
		exec: (sql) => db.execAsync(sql),
		transaction(task) {
			return serial(async () => {
				let result: Awaited<ReturnType<typeof task>> | undefined;
				await db.withExclusiveTransactionAsync(async (txn) => {
					result = await task(executor(txn));
				});
				return result as Awaited<ReturnType<typeof task>>;
			});
		},
		close: () => db.closeAsync(),
	};
}

export function deleteExpoDatabase(name = LOCAL_DATABASE_NAME): Promise<void> {
	return deleteDatabaseAsync(name);
}
