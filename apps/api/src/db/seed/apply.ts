import { eq, getTableColumns } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../client.ts";
import { toCompletionRow, toHabitRow, toUserSettingsRow } from "../records.ts";
import { completions, habits, userSettings } from "../schema.ts";
import type { Seed } from "./build.ts";

const columnCount = (table: typeof habits | typeof completions) =>
	Object.keys(getTableColumns(table)).length;

/** D1 accepts at most 100 bound parameters per statement. */
const MAX_PARAMS = 100;

function chunk<T>(rows: T[], columns: number): T[][] {
	const size = Math.floor(MAX_PARAMS / columns);
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += size) {
		chunks.push(rows.slice(i, i + size));
	}
	return chunks;
}

/**
 * Replaces all data of the seed user in one atomic batch: deletes their rows,
 * then inserts the seed. Running it again gives the same database state.
 */
export async function applySeed(db: Db, seed: Seed): Promise<void> {
	const { userId } = seed;
	const habitRows = seed.habits.map((habit) => toHabitRow(userId, habit));
	const completionRows = seed.completions.map((completion) =>
		toCompletionRow(userId, completion)
	);

	const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
		db.delete(completions).where(eq(completions.user_id, userId)),
		db.delete(habits).where(eq(habits.user_id, userId)),
		db.delete(userSettings).where(eq(userSettings.user_id, userId)),
		db.insert(userSettings).values(toUserSettingsRow(userId, seed.settings)),
	];
	for (const rows of chunk(habitRows, columnCount(habits))) {
		statements.push(db.insert(habits).values(rows));
	}
	for (const rows of chunk(completionRows, columnCount(completions))) {
		statements.push(db.insert(completions).values(rows));
	}
	await db.batch(statements);
}
