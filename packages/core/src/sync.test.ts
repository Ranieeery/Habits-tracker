import type {
	Completion,
	CompletionSetMutation,
	Habit,
	HabitCreateMutation,
	HabitUpdateMutation,
	Mutation,
} from "@habits/contracts";
import { describe, expect, it } from "vitest";
import {
	type ApplyContext,
	applyCompletionSet,
	applyHabitChanges,
	applyMutation,
	blockedBy,
	completionKey,
	materialize,
	orderOutbox,
	remapIds,
	syncState,
} from "./sync.ts";

const T0 = Date.UTC(2026, 9, 9, 15); // 2026-10-09 12:00 in São Paulo
const TODAY = "2026-10-09";

let counter = 0;
/** Deterministic UUID-shaped ids for readable tests. */
function uuid(n = ++counter): string {
	return `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

const HABIT_ID = uuid(1000);

function habit(overrides: Partial<Habit> = {}): Habit {
	return {
		id: HABIT_ID,
		name: "Ler",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-01-01",
		archived_at: null,
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

function set(
	completed: boolean,
	overrides: Partial<CompletionSetMutation> = {}
): CompletionSetMutation {
	return {
		mutation_id: uuid(),
		created_at: T0,
		type: "completion.set",
		id: uuid(),
		habit_id: HABIT_ID,
		date: TODAY,
		completed,
		...overrides,
	};
}

function create(overrides: Partial<HabitCreateMutation> = {}) {
	const mutation: HabitCreateMutation = {
		mutation_id: uuid(),
		created_at: T0,
		type: "habit.create",
		id: uuid(),
		name: "Correr",
		schedule: { type: "weekdays", days: [1, 3] },
		start_date: TODAY,
		...overrides,
	};
	return mutation;
}

function update(changes: HabitUpdateMutation["changes"], habitId = HABIT_ID) {
	const mutation: HabitUpdateMutation = {
		mutation_id: uuid(),
		created_at: T0,
		type: "habit.update",
		habit_id: habitId,
		changes,
	};
	return mutation;
}

function server(now = T0): ApplyContext {
	return { now, today: TODAY, newId: () => uuid() };
}

const done = (state: ReturnType<typeof syncState>, date = TODAY) =>
	state.completions.get(completionKey(HABIT_ID, date));

describe("applyCompletionSet", () => {
	it("creates a live row, or a tombstone when undoing something unknown", () => {
		const input = { id: uuid(), habit_id: HABIT_ID, date: TODAY };
		const marked = applyCompletionSet(null, { ...input, completed: true }, T0);
		expect(marked.completion.deleted_at).toBeNull();
		const unmarked = applyCompletionSet(
			null,
			{ ...input, completed: false },
			T0
		);
		expect(unmarked.completion.deleted_at).toBe(T0);
	});

	it("revives a tombstone with the same id (resurrection)", () => {
		const tombstone: Completion = {
			id: uuid(),
			habit_id: HABIT_ID,
			date: TODAY,
			completed_at: 10,
			created_at: 10,
			updated_at: 20,
			deleted_at: 20,
		};
		const { completion, changed } = applyCompletionSet(
			tombstone,
			{ id: uuid(), habit_id: HABIT_ID, date: TODAY, completed: true },
			T0
		);
		expect(changed).toBe(true);
		expect(completion).toMatchObject({
			id: tombstone.id,
			deleted_at: null,
			completed_at: T0,
			updated_at: T0,
			created_at: 10,
		});
	});

	it("is a no-op when the state is already the requested one", () => {
		const live = applyCompletionSet(
			null,
			{ id: uuid(), habit_id: HABIT_ID, date: TODAY, completed: true },
			T0
		).completion;
		const again = applyCompletionSet(
			live,
			{ id: uuid(), habit_id: HABIT_ID, date: TODAY, completed: true },
			T0 + 5
		);
		expect(again).toEqual({ completion: live, changed: false });
	});
});

describe("applyHabitChanges", () => {
	it("keeps the first archived_at and clears it on unarchive", () => {
		const archived = applyHabitChanges(habit(), { archived: true }, T0).habit;
		expect(archived.archived_at).toBe(T0);
		expect(applyHabitChanges(archived, { archived: true }, T0 + 1)).toEqual({
			habit: archived,
			changed: false,
		});
		const back = applyHabitChanges(archived, { archived: false }, T0 + 2);
		expect(back.habit).toMatchObject({ archived_at: null, updated_at: T0 + 2 });
	});

	it("does not bump updated_at when nothing changes", () => {
		const current = habit();
		expect(
			applyHabitChanges(
				current,
				{ name: "Ler", schedule: current.schedule },
				T0
			).changed
		).toBe(false);
	});
});

describe("applyMutation on the server", () => {
	it("two devices marking the same day keep the first id (canonical)", () => {
		const state = syncState([habit()], []);
		const deviceA = set(true);
		const deviceB = set(true);
		expect(applyMutation(state, deviceA, server())).toEqual({
			status: "applied",
			canonical_id: deviceA.id,
			changed: true,
		});
		expect(applyMutation(state, deviceB, server(T0 + 1))).toEqual({
			status: "applied",
			canonical_id: deviceA.id,
			changed: false,
		});
		expect(state.completions.size).toBe(1);
	});

	it("two devices in opposite states: the last one to sync wins", () => {
		const state = syncState([habit()], []);
		const marked = set(true);
		applyMutation(state, marked, server());
		const outcome = applyMutation(state, set(false), server(T0 + 1));
		expect(outcome).toMatchObject({ canonical_id: marked.id, changed: true });
		expect(done(state)?.deleted_at).toBe(T0 + 1);
	});

	it("unchecking offline and checking again ends live, same id", () => {
		const state = syncState([habit()], []);
		const first = set(true);
		applyMutation(state, first, server());
		applyMutation(state, set(false, { id: first.id }), server());
		applyMutation(state, set(true, { id: first.id }), server());
		expect(done(state)).toMatchObject({ id: first.id, deleted_at: null });
	});

	it("checking and unchecking offline with no server row leaves a tombstone", () => {
		const state = syncState([habit()], []);
		const mark = set(true);
		applyMutation(state, mark, server());
		applyMutation(state, set(false, { id: mark.id }), server());
		expect(done(state)).toMatchObject({ id: mark.id, deleted_at: T0 });
	});

	it("re-applying the same mutation changes nothing (idempotent)", () => {
		const state = syncState([habit()], []);
		const mutation = set(true);
		applyMutation(state, mutation, server());
		const before = done(state);
		expect(applyMutation(state, mutation, server(T0 + 9))).toMatchObject({
			status: "applied",
			changed: false,
		});
		expect(done(state)).toBe(before);
	});

	it("rejects completions outside the date window", () => {
		const state = syncState([habit()], []);
		for (const date of ["2026-10-01", "2026-10-11"]) {
			expect(applyMutation(state, set(true, { date }), server())).toEqual({
				status: "rejected",
				error: {
					code: "date_out_of_range",
					message: "Date is outside the editable window",
					details: { from: "2026-10-02", to: "2026-10-10" },
				},
			});
		}
		// The window edges are accepted.
		expect(
			applyMutation(state, set(true, { date: "2026-10-02" }), server()).status
		).toBe("applied");
		expect(
			applyMutation(state, set(true, { date: "2026-10-10" }), server()).status
		).toBe("applied");
	});

	it("device clock ahead or behind: only the server's today matters", () => {
		const state = syncState([habit()], []);
		// The phone thinks it is 2026-10-12 (ahead) or 2026-09-30 (behind).
		const ahead = set(true, {
			date: "2026-10-12",
			created_at: Date.UTC(2026, 9, 12),
			updated_at: Date.UTC(2026, 9, 12),
		});
		const behind = set(true, {
			date: "2026-09-30",
			created_at: Date.UTC(2026, 8, 30),
		});
		expect(applyMutation(state, ahead, server()).status).toBe("rejected");
		expect(applyMutation(state, behind, server()).status).toBe("rejected");
		// One day ahead is inside the window, stamped with the server's now.
		const tomorrow = set(true, {
			date: "2026-10-10",
			updated_at: Date.UTC(2030, 0, 1),
		});
		applyMutation(state, tomorrow, server());
		expect(done(state, "2026-10-10")).toMatchObject({
			updated_at: T0,
			completed_at: T0,
		});
	});

	it("rejects completions of unknown or deleted habits", () => {
		const state = syncState([habit({ deleted_at: 5 })], []);
		expect(applyMutation(state, set(true), server())).toMatchObject({
			status: "rejected",
			error: { code: "not_found" },
		});
		expect(
			applyMutation(state, set(true, { habit_id: uuid() }), server())
		).toMatchObject({ status: "rejected", error: { code: "not_found" } });
	});

	it("accepts a completion of a habit created earlier in the same batch", () => {
		const state = syncState([], []);
		const newHabit = create({ start_date: "2026-10-05" });
		expect(applyMutation(state, newHabit, server()).status).toBe("applied");
		expect(
			applyMutation(state, set(true, { habit_id: newHabit.id }), server())
				.status
		).toBe("applied");
	});

	it("gives a fresh id when the proposed one is taken elsewhere", () => {
		const taken = uuid();
		const state = syncState([habit()], []);
		const ctx: ApplyContext = {
			...server(),
			isIdTaken: (id) => id === taken,
			newId: () => "11111111-1111-7111-8111-111111111111",
		};
		expect(applyMutation(state, set(true, { id: taken }), ctx)).toMatchObject({
			canonical_id: "11111111-1111-7111-8111-111111111111",
		});
	});

	it("habit.create: idempotent for the owner, conflict for a taken id, window on start_date", () => {
		const state = syncState([habit()], []);
		expect(applyMutation(state, create({ id: HABIT_ID }), server())).toEqual({
			status: "applied",
			canonical_id: HABIT_ID,
			changed: false,
		});
		const taken = uuid();
		expect(
			applyMutation(state, create({ id: taken }), {
				...server(),
				isIdTaken: (id) => id === taken,
			})
		).toMatchObject({ status: "rejected", error: { code: "conflict" } });
		expect(
			applyMutation(state, create({ start_date: "2026-10-01" }), server())
		).toMatchObject({
			status: "rejected",
			error: { code: "date_out_of_range", details: { earliest: "2026-10-02" } },
		});
	});

	it("habit.update merges per field: rename and archive from two devices both survive", () => {
		const state = syncState([habit()], []);
		applyMutation(state, update({ name: "Ler 10 páginas" }), server());
		applyMutation(state, update({ archived: true }), server(T0 + 1));
		expect(state.habits.get(HABIT_ID)).toMatchObject({
			name: "Ler 10 páginas",
			archived_at: T0 + 1,
			updated_at: T0 + 1,
		});
	});
});

describe("materialize (app view: server records + pending mutations)", () => {
	const local: ApplyContext = { now: T0, newId: () => uuid() };

	it("shows pending changes over the server records", () => {
		const pending: Mutation[] = [set(true), update({ name: "Ler mais" })];
		const view = materialize(
			{ habits: [habit()], completions: [] },
			pending,
			local
		);
		expect(done(view)?.deleted_at).toBeNull();
		expect(view.habits.get(HABIT_ID)?.name).toBe("Ler mais");
	});

	it("keeps pending mutations even when the device thinks the date is old", () => {
		// No `today`: the server decides about the window, not the app.
		const old = set(true, { date: "2026-09-01" });
		const view = materialize(
			{ habits: [habit()], completions: [] },
			[old],
			local
		);
		expect(done(view, "2026-09-01")?.deleted_at).toBeNull();
	});

	it("drops back to the server state once a mutation is no longer pending", () => {
		const serverRow: Completion = {
			id: uuid(),
			habit_id: HABIT_ID,
			date: TODAY,
			completed_at: 1,
			created_at: 1,
			updated_at: 1,
			deleted_at: null,
		};
		const mirror = { habits: [habit()], completions: [serverRow] };
		expect(done(materialize(mirror, [set(false)], local))?.deleted_at).toBe(T0);
		expect(done(materialize(mirror, [], local))).toEqual(serverRow);
	});

	it("stores a pulled tombstone of a record the device never saw", () => {
		const tombstone: Completion = {
			id: uuid(),
			habit_id: HABIT_ID,
			date: "2026-10-03",
			completed_at: 1,
			created_at: 1,
			updated_at: 2,
			deleted_at: 2,
		};
		const view = materialize(
			{ habits: [habit()], completions: [tombstone] },
			[],
			local
		);
		expect(done(view, "2026-10-03")?.deleted_at).toBe(2);
	});

	it("shows a habit created offline and its completion", () => {
		const newHabit = create();
		const view = materialize(
			{ habits: [], completions: [] },
			[newHabit, set(true, { habit_id: newHabit.id })],
			local
		);
		expect(view.habits.get(newHabit.id)?.name).toBe("Correr");
		expect(view.completions.size).toBe(1);
	});
});

describe("outbox", () => {
	it("sends a habit.create before the mutations that depend on it", () => {
		const newHabit = create();
		const completion = set(true, { habit_id: newHabit.id });
		const other = set(true);
		const ordered = orderOutbox([
			{ seq: 1, mutation: completion },
			{ seq: 2, mutation: other },
			{ seq: 3, mutation: newHabit },
		]);
		expect(ordered.map((item) => item.mutation)).toEqual([
			newHabit,
			completion,
			other,
		]);
	});

	it("keeps the creation order otherwise", () => {
		const items = [3, 1, 2].map((seq) => ({ seq, mutation: set(seq === 2) }));
		expect(orderOutbox(items).map((item) => item.seq)).toEqual([1, 2, 3]);
	});

	it("blocks the dependents of a failed habit.create", () => {
		const failed = create();
		const dependent = set(true, { habit_id: failed.id });
		const rename = update({ name: "x" }, failed.id);
		const unrelated = set(true);
		const blocked = blockedBy(
			[failed, dependent, rename, unrelated].map((mutation, i) => ({
				seq: i,
				mutation,
			})),
			new Set([failed.mutation_id])
		);
		expect([...blocked.keys()]).toEqual([
			dependent.mutation_id,
			rename.mutation_id,
		]);
		expect(blocked.get(dependent.mutation_id)).toBe(failed.mutation_id);
	});

	it("remaps local completion ids to the server's canonical ids", () => {
		const local = set(false);
		const habitChange = update({ name: "y" });
		const remapped = remapIds(
			[local, habitChange],
			new Map([[local.id, HABIT_ID]])
		);
		expect(remapped[0]).toEqual({ ...local, id: HABIT_ID });
		expect(remapped[1]).toBe(habitChange);
	});
});
