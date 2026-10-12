// Every SQL statement of the local database: the server mirror, the outbox of
// mutations, and small key/value metadata. No domain rules here: those live
// in @habits/core (`materialize`, `remapIds`, ...) and in the repository and
// sync engine that call this store.
import {
	type ApiErrorBody,
	type CalendarDate,
	type Completion,
	type Habit,
	type Mutation,
	type MutationResult,
	type SyncChanges,
	UserSettings,
} from "@habits/contracts";
import { habitDependency, remapIds } from "@habits/core";
import { migrate } from "./migrations.ts";
import type { SqlDatabase, SqlExecutor, SqlValue } from "./sql.ts";

export type OutboxState = "pending" | "applied" | "failed";

export interface OutboxEntry {
	/** Local insertion order. */
	seq: number;
	mutation: Mutation;
	state: OutboxState;
	attempts: number;
	lastError: ApiErrorBody | null;
	createdAt: number;
}

export interface Mirror {
	habits: Habit[];
	completions: Completion[];
}

export interface DateRange {
	from: CalendarDate;
	to: CalendarDate;
}

export interface OutboxCounts {
	pending: number;
	failed: number;
}

type MetaKey =
	| "user_id"
	| "cursor"
	| "last_synced_at"
	| "initial_sync_done"
	/** `SCHEDULE_VERSION` the mirror was pulled with (absent: 1, before 2.2.0). */
	| "schedule_version"
	| "settings"
	| "lock_owner"
	| "lock_until";

interface HabitRow extends Omit<Habit, "schedule"> {
	schedule: string;
}

interface OutboxRow {
	seq: number;
	mutation_id: string;
	payload: string;
	state: OutboxState;
	attempts: number;
	last_error: string | null;
	created_at: number;
}

const HABIT_COLUMNS =
	"id, name, schedule, start_date, archived_at, sort_key, created_at, updated_at, deleted_at";
const COMPLETION_COLUMNS =
	"id, habit_id, date, completed_at, created_at, updated_at, deleted_at";

function toHabit({ schedule, ...row }: HabitRow): Habit {
	return { ...row, schedule: JSON.parse(schedule) as Habit["schedule"] };
}

function toEntry(row: OutboxRow): OutboxEntry {
	return {
		seq: row.seq,
		mutation: JSON.parse(row.payload) as Mutation,
		state: row.state,
		attempts: row.attempts,
		lastError: row.last_error
			? (JSON.parse(row.last_error) as ApiErrorBody)
			: null,
		createdAt: row.created_at,
	};
}

function placeholders(count: number): string {
	return Array.from({ length: count }, () => "?").join(", ");
}

async function setMetaIn(
	tx: SqlExecutor,
	key: MetaKey,
	value: string | null
): Promise<void> {
	if (value === null) {
		await tx.run("DELETE FROM meta WHERE key = ?", [key]);
	} else {
		await tx.run(
			"INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
			[key, value]
		);
	}
}

async function writeMirror(tx: SqlExecutor, changes: SyncChanges) {
	for (const habit of changes.habits) {
		await tx.run(
			`INSERT OR REPLACE INTO habits (${HABIT_COLUMNS}) VALUES (${placeholders(9)})`,
			[
				habit.id,
				habit.name,
				JSON.stringify(habit.schedule),
				habit.start_date,
				habit.archived_at,
				habit.sort_key,
				habit.created_at,
				habit.updated_at,
				habit.deleted_at,
			]
		);
	}
	// REPLACE also drops a row with the same (habit_id, date) and another id:
	// the server's id for a habit and date wins.
	for (const completion of changes.completions) {
		await tx.run(
			`INSERT OR REPLACE INTO completions (${COMPLETION_COLUMNS}) VALUES (${placeholders(7)})`,
			[
				completion.id,
				completion.habit_id,
				completion.date,
				completion.completed_at,
				completion.created_at,
				completion.updated_at,
				completion.deleted_at,
			]
		);
	}
}

async function rewritePayloads(tx: SqlExecutor, entries: OutboxEntry[]) {
	for (const entry of entries) {
		await tx.run("UPDATE outbox SET payload = ? WHERE mutation_id = ?", [
			JSON.stringify(entry.mutation),
			entry.mutation.mutation_id,
		]);
	}
}

export interface LocalStore {
	getMeta(key: MetaKey): Promise<string | null>;
	setMeta(key: MetaKey, value: string | null): Promise<void>;
	/**
	 * Makes the database belong to `userId`, wiping it first if it holds
	 * another user's data. Returns true when it wiped something.
	 */
	ensureUser(userId: string): Promise<boolean>;
	/** Deletes every record, the outbox and all metadata. */
	wipe(): Promise<void>;

	/**
	 * The server's records: every habit, and the completions in `range`
	 * (none for `"habits"`, all when omitted).
	 */
	readMirror(range?: DateRange | "habits"): Promise<Mirror>;
	/** Every outbox entry, in insertion order. */
	readOutbox(): Promise<OutboxEntry[]>;
	counts(): Promise<OutboxCounts>;

	/** A local change: one transaction inserting the mutation. */
	enqueue(mutation: Mutation, now: number): Promise<void>;
	/**
	 * Records the server's answers: applied and duplicate entries become
	 * `applied` (replayed until the next full pull), rejected ones `failed`;
	 * canonical completion ids replace local ones in every entry still kept.
	 */
	applyPushResults(
		sent: readonly OutboxEntry[],
		results: readonly MutationResult[]
	): Promise<void>;
	/** Marks entries failed without sending them (e.g. blocked dependents). */
	failEntries(
		failures: readonly { mutationId: string; error: ApiErrorBody }[]
	): Promise<void>;
	/** A transient failure: counts the attempt, keeps the entries pending. */
	noteAttempt(
		mutationIds: readonly string[],
		error: ApiErrorBody
	): Promise<void>;
	/** Failed entries back to pending (keeps their place in the order). */
	retry(mutationIds: readonly string[]): Promise<void>;
	discard(mutationIds: readonly string[]): Promise<void>;

	/**
	 * Writes a pulled page and its cursor in one transaction, so an
	 * interrupted pull resumes from the last page written. The last page also
	 * drops the `applied` entries: the mirror now has their result.
	 */
	applyPullPage(page: {
		changes: SyncChanges;
		cursor: string;
		has_more: boolean;
	}): Promise<void>;
	/** Drops the mirror and the cursor (server asked for a full pull). */
	resetMirror(): Promise<void>;

	getSettings(): Promise<UserSettings | null>;
	setSettings(settings: UserSettings): Promise<void>;

	/**
	 * Cross-context lock (the background task runs its own JS context):
	 * true if `owner` holds it until `now + ttlMs`.
	 */
	acquireLease(owner: string, now: number, ttlMs: number): Promise<boolean>;
	releaseLease(owner: string): Promise<void>;
}

export function createLocalStore(open: () => Promise<SqlDatabase>): LocalStore {
	let ready: Promise<SqlDatabase> | null = null;
	const db = () => {
		ready ??= open().then(async (database) => {
			await migrate(database);
			return database;
		});
		ready.catch(() => {
			ready = null;
		});
		return ready;
	};

	const readOutboxWith = async (tx: SqlExecutor) =>
		(
			await tx.all<OutboxRow>(
				"SELECT seq, mutation_id, payload, state, attempts, last_error, created_at FROM outbox ORDER BY seq"
			)
		).map(toEntry);

	const getMeta = async (key: MetaKey) =>
		(
			await (
				await db()
			).first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key])
		)?.value ?? null;

	const wipeWith = async (tx: SqlExecutor) => {
		for (const table of ["habits", "completions", "outbox", "meta"]) {
			await tx.run(`DELETE FROM ${table}`);
		}
	};

	return {
		getMeta,
		async setMeta(key, value) {
			await setMetaIn(await db(), key, value);
		},
		async ensureUser(userId) {
			return (await db()).transaction(async (tx) => {
				const row = await tx.first<{ value: string }>(
					"SELECT value FROM meta WHERE key = 'user_id'"
				);
				if (row?.value === userId) return false;
				const wiped = row !== null;
				if (wiped) await wipeWith(tx);
				await setMetaIn(tx, "user_id", userId);
				return wiped;
			});
		},
		async wipe() {
			await (await db()).transaction(wipeWith);
		},

		async readMirror(range) {
			const database = await db();
			const habits = (
				await database.all<HabitRow>(
					`SELECT ${HABIT_COLUMNS} FROM habits ORDER BY created_at, id`
				)
			).map(toHabit);
			if (range === "habits") return { habits, completions: [] };
			const params: SqlValue[] = range ? [range.from, range.to] : [];
			const completions = await database.all<Completion>(
				`SELECT ${COMPLETION_COLUMNS} FROM completions${range ? " WHERE date BETWEEN ? AND ?" : ""} ORDER BY date`,
				params
			);
			return { habits, completions };
		},
		async readOutbox() {
			return readOutboxWith(await db());
		},
		async counts() {
			const rows = await (
				await db()
			).all<{ state: OutboxState; n: number }>(
				"SELECT state, COUNT(*) AS n FROM outbox GROUP BY state"
			);
			const of = (state: OutboxState) =>
				rows.find((row) => row.state === state)?.n ?? 0;
			return { pending: of("pending"), failed: of("failed") };
		},

		async enqueue(mutation, now) {
			await (
				await db()
			).transaction((tx) =>
				tx.run(
					"INSERT INTO outbox (mutation_id, type, habit_id, payload, created_at) VALUES (?, ?, ?, ?, ?)",
					[
						mutation.mutation_id,
						mutation.type,
						mutation.type === "habit.create"
							? mutation.id
							: habitDependency(mutation),
						JSON.stringify(mutation),
						now,
					]
				)
			);
		},
		async applyPushResults(sent, results) {
			const byId = new Map(results.map((r) => [r.mutation_id, r]));
			await (
				await db()
			).transaction(async (tx) => {
				const canonical = new Map<string, string>();
				for (const entry of sent) {
					const { mutation } = entry;
					const result = byId.get(mutation.mutation_id);
					if (!result) {
						await tx.run(
							"UPDATE outbox SET attempts = attempts + 1 WHERE mutation_id = ?",
							[mutation.mutation_id]
						);
					} else if (result.status === "rejected") {
						await tx.run(
							"UPDATE outbox SET state = 'failed', attempts = attempts + 1, last_error = ? WHERE mutation_id = ?",
							[
								JSON.stringify(
									result.error ?? {
										code: "unknown",
										message: "Rejected",
									}
								),
								mutation.mutation_id,
							]
						);
					} else {
						if (
							mutation.type === "completion.set" &&
							result.canonical_id &&
							result.canonical_id !== mutation.id
						) {
							canonical.set(mutation.id, result.canonical_id);
						}
						await tx.run(
							"UPDATE outbox SET state = 'applied', attempts = attempts + 1, last_error = NULL WHERE mutation_id = ?",
							[mutation.mutation_id]
						);
					}
				}
				if (canonical.size === 0) return;
				const kept = await readOutboxWith(tx);
				const remapped = remapIds(
					kept.map((entry) => entry.mutation),
					canonical
				);
				await rewritePayloads(
					tx,
					kept
						.map((entry, i) => ({ ...entry, mutation: remapped[i]! }))
						.filter((entry, i) => entry.mutation !== kept[i]!.mutation)
				);
			});
		},
		async failEntries(failures) {
			await (
				await db()
			).transaction(async (tx) => {
				for (const { mutationId, error } of failures) {
					await tx.run(
						"UPDATE outbox SET state = 'failed', last_error = ? WHERE mutation_id = ?",
						[JSON.stringify(error), mutationId]
					);
				}
			});
		},
		async noteAttempt(mutationIds, error) {
			await (
				await db()
			).transaction(async (tx) => {
				for (const id of mutationIds) {
					await tx.run(
						"UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE mutation_id = ?",
						[JSON.stringify(error), id]
					);
				}
			});
		},
		async retry(mutationIds) {
			await (
				await db()
			).transaction(async (tx) => {
				for (const id of mutationIds) {
					await tx.run(
						"UPDATE outbox SET state = 'pending', last_error = NULL WHERE mutation_id = ? AND state = 'failed'",
						[id]
					);
				}
			});
		},
		async discard(mutationIds) {
			await (
				await db()
			).transaction(async (tx) => {
				for (const id of mutationIds) {
					await tx.run("DELETE FROM outbox WHERE mutation_id = ?", [id]);
				}
			});
		},

		async applyPullPage({ changes, cursor, has_more }) {
			await (
				await db()
			).transaction(async (tx) => {
				await writeMirror(tx, changes);
				await setMetaIn(tx, "cursor", cursor);
				if (!has_more) {
					await tx.run("DELETE FROM outbox WHERE state = 'applied'");
				}
			});
		},
		async resetMirror() {
			await (
				await db()
			).transaction(async (tx) => {
				await tx.run("DELETE FROM habits");
				await tx.run("DELETE FROM completions");
				await setMetaIn(tx, "cursor", null);
			});
		},

		async getSettings() {
			const value = await getMeta("settings");
			if (!value) return null;
			// A copy saved by 2.1.0 lacks the 2.2.0 fields: the schema fills
			// their defaults.
			const stored: unknown = JSON.parse(value);
			const parsed = UserSettings.safeParse(stored);
			return parsed.success ? parsed.data : (stored as UserSettings);
		},
		async setSettings(settings) {
			await setMetaIn(await db(), "settings", JSON.stringify(settings));
		},

		async acquireLease(owner, now, ttlMs) {
			return (await db()).transaction(async (tx) => {
				const rows = await tx.all<{ key: MetaKey; value: string }>(
					"SELECT key, value FROM meta WHERE key IN ('lock_owner', 'lock_until')"
				);
				const holder = rows.find((row) => row.key === "lock_owner")?.value;
				const until = Number(
					rows.find((row) => row.key === "lock_until")?.value ?? 0
				);
				if (holder && holder !== owner && until > now) return false;
				await setMetaIn(tx, "lock_owner", owner);
				await setMetaIn(tx, "lock_until", String(now + ttlMs));
				return true;
			});
		},
		async releaseLease(owner) {
			await (
				await db()
			).transaction(async (tx) => {
				const holder = await tx.first<{ value: string }>(
					"SELECT value FROM meta WHERE key = 'lock_owner'"
				);
				if (holder?.value !== owner) return;
				await setMetaIn(tx, "lock_owner", null);
				await setMetaIn(tx, "lock_until", null);
			});
		},
	};
}
