// Offline sync for the mobile app: `POST /v1/sync/push` applies a batch of
// mutations (idempotent by `mutation_id`) and `GET /v1/sync/pull` pages
// through the changes since a cursor. The rules live in `@habits/core`
// (`applyMutation`); the cursor is the per-user `server_seq` that SQLite
// triggers give every write (see `db/schema.ts` and migration `0004_sync`).
import {
	type ApiErrorBody,
	Mutation,
	type MutationResult,
	SYNC_PROTOCOL_VERSION,
	SYNC_PULL_DEFAULT_LIMIT,
	type SyncPullResponse,
	SyncPullQuery,
	SyncPullResponse as SyncPullResponseSchema,
	SyncPushEnvelope,
	SyncPushResponse,
} from "@habits/contracts";
import {
	applyMutation,
	completionKey,
	syncState,
	writeWindow,
} from "@habits/core";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import {
	commonErrors,
	errorBody,
	jsonBody,
	jsonResponse,
} from "../http/errors.ts";
import {
	clientScheduleVersion,
	isReadableBy,
} from "../http/schedule-version.ts";
import { userToday } from "../http/today.ts";
import type { HabitFieldChanges } from "../repos/habits.ts";
import { uuidV7 } from "../lib/ids.ts";
import {
	findProcessedMutations,
	findTakenIds,
	loadSyncRecords,
	readChanges,
	writeSyncChanges,
} from "../repos/sync.ts";

const tags = ["sync"];

const CURSOR_PATTERN = /^1\.(\d{1,15})$/;

export function encodeCursor(seq: number): string {
	return `1.${seq}`;
}

/** The seq in a cursor, or null if it is not one this server wrote. */
export function decodeCursor(cursor: string): number | null {
	const match = CURSOR_PATTERN.exec(cursor);
	return match ? Number(match[1]) : null;
}

const pushRoute = createRoute({
	method: "post",
	path: "/sync/push",
	tags,
	summary: "Apply a batch of offline mutations (idempotent by mutation_id)",
	description:
		"Mutations are applied in order; each gets a result. Rejections are permanent and only affect that mutation. Last write wins in arrival order; the server's clock stamps every write.",
	request: { body: jsonBody(SyncPushEnvelope) },
	responses: {
		200: jsonResponse(SyncPushResponse, "One result per mutation"),
		...commonErrors,
	},
});

const pullRoute = createRoute({
	method: "get",
	path: "/sync/pull",
	tags,
	summary: "Changes since a cursor (tombstones included), paginated",
	description:
		"Habits whose schedule type is newer than the client's X-Habits-Schedule-Version (1 when absent), and their completions, are left out; the cursor still moves past them, so a page may hold fewer records than limit.",
	request: { query: SyncPullQuery },
	responses: {
		200: jsonResponse(SyncPullResponseSchema, "A page of changes"),
		...commonErrors,
	},
});

function rejected(mutationId: string, error: ApiErrorBody): MutationResult {
	return { mutation_id: mutationId, status: "rejected", error };
}

export const syncRoutes = router()
	.openapi(pushRoute, async (c) => {
		const body = c.req.valid("json");
		if (body.protocol > SYNC_PROTOCOL_VERSION) {
			return c.json(
				errorBody("validation_error", "Unsupported sync protocol", {
					supported: SYNC_PROTOCOL_VERSION,
				}),
				422
			);
		}
		const { db, userId } = c.var;
		const { now, today } = await userToday(c);

		// Parse each mutation on its own: one bad mutation is rejected alone.
		const results: (MutationResult | undefined)[] = [];
		const valid: { index: number; mutation: Mutation }[] = [];
		for (const [index, raw] of body.mutations.entries()) {
			const parsed = Mutation.safeParse(raw);
			if (parsed.success) {
				valid.push({ index, mutation: parsed.data });
				results.push(undefined);
			} else {
				results.push(
					rejected(raw.mutation_id, {
						code: "validation_error",
						message: "Invalid mutation",
						details: parsed.error.issues,
					})
				);
			}
		}

		const habitIds = new Set<string>();
		const proposedIds = new Set<string>();
		for (const { mutation } of valid) {
			if (mutation.type === "habit.create") {
				habitIds.add(mutation.id);
				proposedIds.add(mutation.id);
			} else {
				habitIds.add(mutation.habit_id);
				if (mutation.type === "completion.set") proposedIds.add(mutation.id);
			}
		}
		const processed = await findProcessedMutations(
			db,
			userId,
			valid.map(({ mutation }) => mutation.mutation_id)
		);
		const window = writeWindow(today);
		const [records, taken] = await Promise.all([
			loadSyncRecords(db, userId, [...habitIds], window),
			findTakenIds(db, [...proposedIds]),
		]);

		const state = syncState(records.habits, records.completions);
		const existingHabits = new Set(records.habits.map((habit) => habit.id));
		const createdHabits: string[] = [];
		const habitChanges = new Map<string, HabitFieldChanges>();
		const changedCompletions = new Set<string>();
		const appliedCompletionKeys = new Map<number, string>();
		const processedNow: { mutation_id: string; canonical_id: string }[] = [];
		const firstResult = new Map<string, MutationResult>();
		const ctx = {
			now,
			today,
			isIdTaken: (id: string) => taken.has(id),
			newId: () => uuidV7(now),
		};

		for (const { index, mutation } of valid) {
			const { mutation_id } = mutation;
			const earlier = firstResult.get(mutation_id);
			const stored = processed.get(mutation_id);
			if (earlier) {
				results[index] =
					earlier.status === "rejected"
						? earlier
						: { ...earlier, status: "duplicate" };
				continue;
			}
			if (stored !== undefined) {
				results[index] = {
					mutation_id,
					status: "duplicate",
					canonical_id: stored,
				};
				firstResult.set(mutation_id, results[index]);
				continue;
			}

			const outcome = applyMutation(state, mutation, ctx);
			if (outcome.status === "rejected") {
				results[index] = rejected(mutation_id, outcome.error);
				firstResult.set(mutation_id, results[index]);
				continue;
			}
			results[index] = {
				mutation_id,
				status: "applied",
				canonical_id: outcome.canonical_id,
			};
			firstResult.set(mutation_id, results[index]);
			processedNow.push({ mutation_id, canonical_id: outcome.canonical_id });
			if (!outcome.changed) continue;
			switch (mutation.type) {
				case "habit.create":
					createdHabits.push(mutation.id);
					break;
				case "habit.update":
				case "habit.delete":
				case "habit.restore":
					// A habit created in this batch is inserted in its final state.
					if (existingHabits.has(mutation.habit_id)) {
						habitChanges.set(mutation.habit_id, {
							...habitChanges.get(mutation.habit_id),
							...(mutation.type === "habit.update"
								? mutation.changes
								: { deleted: mutation.type === "habit.delete" }),
						});
					}
					break;
				case "completion.set": {
					const key = completionKey(mutation.habit_id, mutation.date);
					changedCompletions.add(key);
					appliedCompletionKeys.set(index, key);
					break;
				}
			}
		}

		const storedIds = await writeSyncChanges(
			db,
			userId,
			{
				newHabits: createdHabits.map((id) => state.habits.get(id)!),
				habitUpdates: [...habitChanges].map(([id, changes]) => ({
					habit: state.habits.get(id)!,
					changes,
				})),
				completions: [...changedCompletions].map((key) =>
					state.completions.get(key)!
				),
				processed: processedNow,
			},
			now
		);
		// A concurrent push may have stored the same habit and date first.
		for (const [index, key] of appliedCompletionKeys) {
			const result = results[index];
			const id = storedIds.get(key);
			if (result && id) result.canonical_id = id;
		}

		return c.json({ results: results.filter((r) => r !== undefined) }, 200);
	})
	.openapi(pullRoute, async (c) => {
		const { cursor, limit = SYNC_PULL_DEFAULT_LIMIT } = c.req.valid("query");
		const { db, userId } = c.var;
		const after = cursor === undefined ? 0 : decodeCursor(cursor);
		const reset = (): SyncPullResponse => ({
			cursor: encodeCursor(0),
			has_more: true,
			changes: { habits: [], completions: [] },
			reset: true,
		});
		if (after === null) return c.json(reset(), 200);

		const page = await readChanges(db, userId, after, limit);
		const { seq, purgedSeq } = page.position;
		// A cursor from the future (restored database) or older than purged
		// tombstones may have missed changes: start over.
		if (after > seq || (after > 0 && after < purgedSeq)) {
			return c.json(reset(), 200);
		}

		const merged = [
			...page.habits.map((record) => ({ kind: "habit" as const, record })),
			...page.completions.map((record) => ({
				kind: "completion" as const,
				record,
			})),
		].sort((a, b) => a.record.server_seq - b.record.server_seq);
		const delivered = merged.slice(0, limit);
		// The cursor follows every row read, so leaving rows out below never
		// stalls an older client.
		const last = delivered.at(-1);
		const version = clientScheduleVersion(c);
		const hidden = new Set(
			page.schedules
				.filter((habit) => !isReadableBy(habit, version))
				.map((habit) => habit.id)
		);
		const response: SyncPullResponse = {
			cursor: encodeCursor(last ? last.record.server_seq : after),
			has_more: merged.length > limit,
			changes: { habits: [], completions: [] },
			remaining: Math.max(0, page.total - delivered.length),
		};
		for (const item of delivered) {
			const habitId =
				item.kind === "habit" ? item.record.id : item.record.habit_id;
			if (hidden.has(habitId)) continue;
			if (item.kind === "habit") {
				const { server_seq: _, ...habit } = item.record;
				response.changes.habits.push(habit);
			} else {
				const { server_seq: _, ...completion } = item.record;
				response.changes.completions.push(completion);
			}
		}
		return c.json(response, 200);
	});
