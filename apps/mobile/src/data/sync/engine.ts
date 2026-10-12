// The sync engine: pushes the outbox, then pulls the server's changes page by
// page. One run at a time (in-memory lock plus a lease in the database for
// the background task's separate JS context); every step is written in its
// own local transaction, so an interrupted run resumes without duplicates:
// resent mutations come back as `duplicate`, and the pull continues from the
// last cursor written.
import {
	type ApiErrorBody,
	type Mutation,
	type MutationResult,
	SCHEDULE_VERSION,
	type UserSettings,
} from "@habits/contracts";
import { blockedBy, habitDependency, orderOutbox } from "@habits/core";
import type { LocalStore } from "../local/store.ts";
import { classifyFailure, type SyncTransport } from "./transport.ts";

export const PUSH_BATCH_SIZE = 50;
export const PULL_PAGE_SIZE = 200;
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 15 * 60_000;
export const BACKOFF_MIN_MS = 1_000;
export const LEASE_MS = 60_000;
export const WRITE_DEBOUNCE_MS = 2_000;
/** Above this, the device clock is reported as wrong. */
export const CLOCK_SKEW_WARNING_MS = 5 * 60_000;

/** Error stored on entries not sent because a habit they need failed. */
export const DEPENDENCY_FAILED_CODE = "dependency_failed";

export type SyncReason =
	| "launch"
	| "foreground"
	| "network"
	| "write"
	| "interval"
	| "manual"
	| "retry"
	| "background";

/** Reasons that wait for the backoff after a failure instead of skipping it. */
const PATIENT_REASONS: ReadonlySet<SyncReason> = new Set(["write", "interval"]);

export interface SyncStatus {
	/** `offline`: the server could not be reached; `error`: see `error`. */
	state: "idle" | "syncing" | "offline" | "error";
	error: "unauthorized" | "server" | null;
	pending: number;
	failed: number;
	lastSyncedAt: number | null;
	/** True once a full first pull finished for this user. */
	initialSyncDone: boolean;
	/** Records received by the pull in progress and the server's estimate left. */
	progress: { received: number; remaining: number | null } | null;
	nextRetryAt: number | null;
	clockSkewMs: number | null;
}

export type SyncOutcome = "synced" | "offline" | "failed" | "busy" | "skipped";

export interface Timers {
	setTimeout(callback: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface SyncEngineDeps {
	store: LocalStore;
	transport: SyncTransport;
	now: () => number;
	/** In [0, 1): backoff jitter. */
	random: () => number;
	timers: Timers;
	/** Unique per JS context: the lease owner. */
	owner: string;
	onUnauthorized: () => void;
	/** Local records changed (pull, push results, failures): refresh screens. */
	onDataChanged: () => void;
	onSettingsChanged?: (settings: UserSettings) => void;
}

export interface SyncEngine {
	getStatus(): SyncStatus;
	subscribe(listener: () => void): () => void;
	/** Runs a sync now (or joins the one running); never throws. */
	sync(reason: SyncReason): Promise<SyncOutcome>;
	/** A local write happened: refresh the counts and sync soon (debounced). */
	notifyLocalWrite(): void;
	/** Network state from the OS; regaining it syncs at once. */
	setOnline(online: boolean): void;
	/** Loads counts and flags from the database (call once per user). */
	refresh(): Promise<void>;
	retry(mutationIds: readonly string[]): Promise<void>;
	discard(mutationIds: readonly string[]): Promise<void>;
	/**
	 * Cancels timers and waits for a run in progress; syncs are skipped until
	 * `start` (sign-out wipes the database right after).
	 */
	stop(): Promise<void>;
	start(): void;
}

/** Full jitter: uniform in [min, min(max, base * 2^failures)]. */
export function backoffDelay(failures: number, random: number): number {
	const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** failures);
	return Math.max(BACKOFF_MIN_MS, Math.floor(random * cap));
}

/**
 * A habit.create rejected in the same batch as changes of that habit makes
 * them fail as `not_found`; report them as depending on it instead, so the
 * failures list groups them (retry or discard together).
 */
export function linkDependents(
	batch: readonly { mutation: Mutation }[],
	results: readonly MutationResult[]
): MutationResult[] {
	const rejected = new Set(
		results
			.filter((result) => result.status === "rejected")
			.map((result) => result.mutation_id)
	);
	const failedCreates = new Map<string, string>();
	for (const { mutation } of batch) {
		if (
			mutation.type === "habit.create" &&
			rejected.has(mutation.mutation_id)
		) {
			failedCreates.set(mutation.id, mutation.mutation_id);
		}
	}
	if (failedCreates.size === 0) return [...results];
	const dependencyOf = new Map(
		batch.map(({ mutation }) => [
			mutation.mutation_id,
			habitDependency(mutation),
		])
	);
	return results.map((result) => {
		const habitId = dependencyOf.get(result.mutation_id);
		const create = habitId ? failedCreates.get(habitId) : undefined;
		if (result.status !== "rejected" || !create) return result;
		return {
			...result,
			error: {
				code: DEPENDENCY_FAILED_CODE,
				message: "Depends on a habit that was not saved",
				details: { mutation_id: create },
			},
		};
	});
}

const INITIAL_STATUS: SyncStatus = {
	state: "idle",
	error: null,
	pending: 0,
	failed: 0,
	lastSyncedAt: null,
	initialSyncDone: false,
	progress: null,
	nextRetryAt: null,
	clockSkewMs: null,
};

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
	const { store, transport, now, timers } = deps;
	let status = INITIAL_STATUS;
	const listeners = new Set<() => void>();
	let running: Promise<SyncOutcome> | null = null;
	let again: SyncReason | null = null;
	let failures = 0;
	let retryTimer: unknown = null;
	let writeTimer: unknown = null;
	// Nothing to sync before a user is known: `start` after sign-in.
	let stopped = true;
	let online = true;

	const set = (changes: Partial<SyncStatus>) => {
		status = { ...status, ...changes };
		for (const listener of listeners) listener();
	};

	const refreshCounts = async () => {
		const counts = await store.counts();
		if (counts.pending !== status.pending || counts.failed !== status.failed) {
			set(counts);
		}
	};

	const clearTimer = (handle: unknown) => {
		if (handle !== null) timers.clearTimeout(handle);
	};

	const scheduleRetry = (retryAfterMs: number | null) => {
		const delay = Math.max(
			backoffDelay(failures, deps.random()),
			retryAfterMs ?? 0
		);
		failures += 1;
		clearTimer(retryTimer);
		const at = now() + delay;
		retryTimer = timers.setTimeout(() => {
			retryTimer = null;
			void engine.sync("retry");
		}, delay);
		set({ nextRetryAt: at });
	};

	async function pushAll(): Promise<boolean> {
		let isolate = false;
		let changed = false;
		for (;;) {
			const entries = await store.readOutbox();
			const failedIds = new Set(
				entries
					.filter((entry) => entry.state === "failed")
					.map((entry) => entry.mutation.mutation_id)
			);
			const blocked = blockedBy(entries, failedIds);
			if (blocked.size > 0) {
				await store.failEntries(
					[...blocked].map(([mutationId, dependency]) => ({
						mutationId,
						error: {
							code: DEPENDENCY_FAILED_CODE,
							message: "Depends on a habit that was not saved",
							details: { mutation_id: dependency },
						},
					}))
				);
				changed = true;
				continue;
			}
			const batch = orderOutbox(
				entries.filter((entry) => entry.state === "pending")
			).slice(0, isolate ? 1 : PUSH_BATCH_SIZE);
			const first = batch[0];
			if (!first) return changed;

			let results;
			try {
				results = await transport.push(batch.map((entry) => entry.mutation));
			} catch (error) {
				const failure = classifyFailure(error);
				if (failure.kind === "rejected") {
					// The whole request was refused: find the culprit by sending
					// one at a time; alone, its refusal is its own.
					if (batch.length > 1) {
						isolate = true;
						continue;
					}
					await store.failEntries([
						{ mutationId: first.mutation.mutation_id, error: failure.error },
					]);
					changed = true;
					continue;
				}
				const note: ApiErrorBody =
					failure.kind === "transient"
						? { code: "transient", message: `HTTP ${failure.status}` }
						: { code: failure.kind, message: failure.kind };
				await store.noteAttempt(
					batch.map((entry) => entry.mutation.mutation_id),
					note
				);
				throw error;
			}
			const answered = new Set(results.map((result) => result.mutation_id));
			await store.applyPushResults(batch, linkDependents(batch, results));
			changed = true;
			// A server that answers nothing for the batch would loop forever.
			if (!batch.some((entry) => answered.has(entry.mutation.mutation_id))) {
				throw new Error("Push answered none of the mutations");
			}
		}
	}

	async function pullAll(): Promise<boolean> {
		let cursor = await store.getMeta("cursor");
		let received = 0;
		let resets = 0;
		let changed = false;
		// A mirror pulled by an older build (2.1.0 announced no schedule
		// version) lacks the habits the API left out for it, behind its cursor:
		// pull everything again (the outbox stays).
		const pulledWith = Number((await store.getMeta("schedule_version")) ?? 1);
		if (pulledWith < SCHEDULE_VERSION) {
			if (cursor !== null) {
				await store.resetMirror();
				cursor = null;
				changed = true;
			}
			await store.setMeta("schedule_version", String(SCHEDULE_VERSION));
		}
		for (;;) {
			const page = await transport.pull(cursor, PULL_PAGE_SIZE);
			if (page.reset) {
				// Our cursor is too old (or unknown): start over from nothing.
				if (++resets > 1) throw new Error("Pull keeps asking for a reset");
				await store.resetMirror();
				cursor = null;
				received = 0;
				changed = true;
				continue;
			}
			await store.applyPullPage(page);
			cursor = page.cursor;
			const count =
				page.changes.habits.length + page.changes.completions.length;
			received += count;
			if (count > 0) changed = true;
			set({ progress: { received, remaining: page.remaining ?? null } });
			if (!page.has_more) return changed;
		}
	}

	async function refreshSettings() {
		const settings = await transport.getSettings();
		const cached = await store.getSettings();
		if (JSON.stringify(cached) !== JSON.stringify(settings)) {
			await store.setSettings(settings);
			deps.onSettingsChanged?.(settings);
		}
	}

	async function runOnce(): Promise<SyncOutcome> {
		if (!(await store.acquireLease(deps.owner, now(), LEASE_MS))) {
			return "busy";
		}
		set({ state: "syncing", error: null, progress: null });
		let changed = false;
		try {
			changed = (await pushAll()) || changed;
			await refreshCounts();
			changed = (await pullAll()) || changed;
			await refreshSettings();
			const at = now();
			await store.setMeta("initial_sync_done", "1");
			await store.setMeta("last_synced_at", String(at));
			failures = 0;
			clearTimer(retryTimer);
			retryTimer = null;
			set({
				state: "idle",
				error: null,
				lastSyncedAt: at,
				initialSyncDone: true,
				progress: null,
				nextRetryAt: null,
				clockSkewMs: transport.clockSkewMs(),
			});
			return "synced";
		} catch (error) {
			const failure = classifyFailure(error);
			set({ progress: null, clockSkewMs: transport.clockSkewMs() });
			if (failure.kind === "unauthorized") {
				set({ state: "error", error: "unauthorized", nextRetryAt: null });
				deps.onUnauthorized();
				return "failed";
			}
			if (failure.kind === "offline") {
				set({ state: "offline", error: null });
				scheduleRetry(null);
				return "offline";
			}
			set({ state: "error", error: "server" });
			scheduleRetry(failure.kind === "transient" ? failure.retryAfterMs : null);
			return "failed";
		} finally {
			await store.releaseLease(deps.owner).catch(() => undefined);
			await refreshCounts().catch(() => undefined);
			if (changed) deps.onDataChanged();
		}
	}

	const engine: SyncEngine = {
		getStatus: () => status,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async sync(reason) {
			if (stopped) return "skipped";
			if (running) {
				again = reason;
				return running;
			}
			if (
				PATIENT_REASONS.has(reason) &&
				status.nextRetryAt !== null &&
				status.nextRetryAt > now()
			) {
				return "skipped";
			}
			if (!online && reason !== "manual") {
				set({ state: "offline" });
				return "offline";
			}
			running = runOnce().finally(() => {
				running = null;
			});
			const outcome = await running;
			if (again && !stopped) {
				const next = again;
				again = null;
				return engine.sync(next);
			}
			return outcome;
		},
		notifyLocalWrite() {
			void refreshCounts().catch(() => undefined);
			clearTimer(writeTimer);
			writeTimer = timers.setTimeout(() => {
				writeTimer = null;
				void engine.sync("write");
			}, WRITE_DEBOUNCE_MS);
		},
		setOnline(next) {
			const regained = next && !online;
			online = next;
			if (!next && status.state !== "syncing") set({ state: "offline" });
			if (regained) {
				failures = 0;
				set({ nextRetryAt: null });
				void engine.sync("network");
			}
		},
		async refresh() {
			const [counts, done, last] = await Promise.all([
				store.counts(),
				store.getMeta("initial_sync_done"),
				store.getMeta("last_synced_at"),
			]);
			set({
				...counts,
				initialSyncDone: done === "1",
				lastSyncedAt: last ? Number(last) : null,
			});
		},
		async retry(mutationIds) {
			await store.retry(mutationIds);
			await refreshCounts();
			deps.onDataChanged();
			void engine.sync("manual");
		},
		async discard(mutationIds) {
			await store.discard(mutationIds);
			await refreshCounts();
			deps.onDataChanged();
		},
		async stop() {
			stopped = true;
			clearTimer(retryTimer);
			clearTimer(writeTimer);
			retryTimer = null;
			writeTimer = null;
			failures = 0;
			again = null;
			await running?.catch(() => undefined);
			status = INITIAL_STATUS;
			for (const listener of listeners) listener();
		},
		start() {
			stopped = false;
		},
	};
	return engine;
}
