import { eq, getTableColumns, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../client.ts";
import { toCompletionRow, toHabitRow, toUserSettingsRow } from "../records.ts";
import { account, completions, habits, user, userSettings } from "../schema.ts";
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
 * Replaces the seed user and all their data in one atomic batch: deleting the
 * Better Auth `user` (by id, or a previous user with the same email) cascades
 * to sessions, accounts and every domain row; then the user, their email and
 * password credential, settings, habits and completions are inserted. Running
 * it again gives the same database state (apart from the password salt).
 *
 * `passwordHash` comes from `hashPassword` (random salt), so `buildSeed` stays
 * pure and deterministic.
 */
export async function applySeed(
	db: Db,
	seed: Seed,
	passwordHash: string
): Promise<void> {
	const { userId } = seed;
	const createdAt = new Date(seed.user.created_at);
	const habitRows = seed.habits.map((habit) => toHabitRow(userId, habit));
	const completionRows = seed.completions.map((completion) =>
		toCompletionRow(userId, completion)
	);

	const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
		db
			.delete(user)
			.where(or(eq(user.id, userId), eq(user.email, seed.user.email))),
		db.insert(user).values({
			id: userId,
			name: seed.user.name,
			email: seed.user.email,
			emailVerified: true,
			createdAt,
			updatedAt: createdAt,
		}),
		// Same shape Better Auth gives email/password accounts.
		db.insert(account).values({
			id: userId,
			accountId: userId,
			providerId: "credential",
			userId,
			password: passwordHash,
			createdAt,
			updatedAt: createdAt,
		}),
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
