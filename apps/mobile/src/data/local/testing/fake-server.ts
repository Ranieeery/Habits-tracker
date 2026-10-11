// An in-memory sync server for engine tests: the same rules as the API
// (`applyMutation` from core, a per-user seq feed, idempotency by
// mutation_id), with hooks to fail requests the way a network does.
import type {
	Completion,
	Habit,
	Mutation,
	MutationResult,
	SyncPullResponse,
	UserSettings,
} from "@habits/contracts";
import {
	applyMutation,
	completionKey,
	syncState,
	todayIn,
	uuidV7,
} from "@habits/core";
import type { SyncTransport } from "../../sync/transport.ts";
import { TransportError, type TransportFailure } from "../../sync/transport.ts";

export const TIME_ZONE = "America/Sao_Paulo";

export interface FakeServer extends SyncTransport {
	state: ReturnType<typeof syncState>;
	settings: UserSettings;
	/** Calls received, for assertions. */
	calls: { push: Mutation[][]; pull: (string | null)[] };
	/** Fails the next request(s) of a kind with `failure`. */
	failNext(
		kind: "push" | "pull" | "settings",
		failure: TransportFailure,
		times?: number
	): void;
	/** Applies the next push but loses its response (network drop). */
	dropNextPushResponse(): void;
	/** Next pull answers `reset: true`. */
	resetNextPull(): void;
	/** A write made by another device (REST or sync) at `now`. */
	write(mutation: Mutation): MutationResult;
	setNow(ms: number): void;
	skewMs: number | null;
}

export function createFakeServer(nowMs: number): FakeServer {
	let now = nowMs;
	let seq = 0;
	const seqOf = new Map<string, number>(); // "h:<id>" | "c:<id>"
	const processed = new Map<string, string>();
	const failures: Record<string, TransportFailure[]> = {
		push: [],
		pull: [],
		settings: [],
	};
	let dropPush = false;
	let resetPull = false;
	const state = syncState([], []);
	const ids = () => uuidV7(now, crypto.getRandomValues(new Uint8Array(16)));

	const bump = (key: string) => seqOf.set(key, ++seq);

	function apply(mutation: Mutation): MutationResult {
		const stored = processed.get(mutation.mutation_id);
		if (stored) {
			return {
				mutation_id: mutation.mutation_id,
				status: "duplicate",
				canonical_id: stored,
			};
		}
		const before = new Map(state.completions);
		const habitsBefore = new Map(state.habits);
		const outcome = applyMutation(state, mutation, {
			now,
			today: todayIn(TIME_ZONE, now),
			newId: ids,
		});
		if (outcome.status === "rejected") {
			return {
				mutation_id: mutation.mutation_id,
				status: "rejected",
				error: outcome.error,
			};
		}
		for (const [id, habit] of state.habits) {
			if (habitsBefore.get(id) !== habit) bump(`h:${id}`);
		}
		for (const [key, completion] of state.completions) {
			if (before.get(key) !== completion) bump(`c:${completion.id}`);
		}
		processed.set(mutation.mutation_id, outcome.canonical_id);
		return {
			mutation_id: mutation.mutation_id,
			status: "applied",
			canonical_id: outcome.canonical_id,
		};
	}

	const take = (kind: string) => {
		const failure = failures[kind]!.shift();
		if (failure) throw new TransportError(failure);
	};

	const server: FakeServer = {
		state,
		settings: {
			timezone: TIME_ZONE,
			reminder_time: null,
			created_at: 0,
			updated_at: 0,
		},
		calls: { push: [], pull: [] },
		skewMs: 0,
		failNext(kind, failure, times = 1) {
			for (let i = 0; i < times; i++) failures[kind]!.push(failure);
		},
		dropNextPushResponse() {
			dropPush = true;
		},
		resetNextPull() {
			resetPull = true;
		},
		write: apply,
		setNow(ms) {
			now = ms;
		},
		async push(mutations) {
			server.calls.push.push([...mutations]);
			take("push");
			const results = mutations.map(apply);
			if (dropPush) {
				dropPush = false;
				throw new TransportError({ kind: "offline" });
			}
			return results;
		},
		async pull(cursor, limit): Promise<SyncPullResponse> {
			server.calls.pull.push(cursor);
			take("pull");
			if (resetPull) {
				resetPull = false;
				return {
					cursor: "1.0",
					has_more: true,
					changes: { habits: [], completions: [] },
					reset: true,
				};
			}
			const after = cursor ? Number(cursor.slice(2)) : 0;
			const records: { seq: number; habit?: Habit; completion?: Completion }[] =
				[];
			for (const habit of state.habits.values()) {
				records.push({ seq: seqOf.get(`h:${habit.id}`)!, habit });
			}
			for (const completion of state.completions.values()) {
				records.push({ seq: seqOf.get(`c:${completion.id}`)!, completion });
			}
			const newer = records
				.filter((record) => record.seq > after)
				.sort((a, b) => a.seq - b.seq);
			const page = newer.slice(0, limit);
			return {
				cursor: `1.${page.at(-1)?.seq ?? after}`,
				has_more: newer.length > limit,
				remaining: newer.length - page.length,
				changes: {
					habits: page.flatMap((r) => (r.habit ? [r.habit] : [])),
					completions: page.flatMap((r) =>
						r.completion ? [r.completion] : []
					),
				},
			};
		},
		async getSettings() {
			take("settings");
			return server.settings;
		},
		clockSkewMs: () => server.skewMs,
	};
	return server;
}

/** The server's live completion for a habit and date, if any. */
export function serverCompletion(
	server: FakeServer,
	habitId: string,
	date: string
): Completion | undefined {
	return server.state.completions.get(completionKey(habitId, date));
}
