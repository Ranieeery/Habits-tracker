// Deleting and restoring habits (2.11.0): the rules shared by the API and
// the app, and what a deleted habit does (nothing) to every view built on
// the records, so the history is the same as before once it is restored.
import type {
	Completion,
	Habit,
	HabitDeleteMutation,
	HabitRestoreMutation,
	Mutation,
} from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { selectDigestContent } from "./digest.ts";
import { heatmapYearRange } from "./grid.ts";
import { overdueOn, pendingTodayCount, todayView } from "./overdue.ts";
import { overviewStats } from "./overview.ts";
import { summarizeDay } from "./progress.ts";
import { keyAfterLast } from "./sort-key.ts";
import {
	type ApplyContext,
	applyHabitDelete,
	applyHabitRestore,
	applyMutation,
	ARCHIVED_REQUIRED_ERROR,
	blockedBy,
	habitDependency,
	materialize,
	orderOutbox,
	syncState,
} from "./sync.ts";
import { upcoming } from "./upcoming.ts";
import { dayView, summarizeYear } from "./views.ts";

const TZ = { timeZone: "America/Sao_Paulo" };
const TODAY = "2026-10-15";
const T0 = Date.UTC(2026, 9, 15, 15);
const ARCHIVED_AT = Date.UTC(2026, 9, 14, 15);

let counter = 0;
function uuid(n = ++counter): string {
	return `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

const LER = uuid(9001);
const CORRER = uuid(9002);
const CONTA = uuid(9003);

function habit(overrides: Partial<Habit> = {}): Habit {
	return {
		id: LER,
		name: "Ler",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-10-01",
		archived_at: ARCHIVED_AT,
		sort_key: "a0",
		created_at: Date.UTC(2026, 9, 1, 12),
		updated_at: ARCHIVED_AT,
		deleted_at: null,
		...overrides,
	};
}

function completion(habitId: string, date: string): Completion {
	return {
		id: uuid(),
		habit_id: habitId,
		date,
		completed_at: 1,
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
	};
}

const del = (habitId = LER): HabitDeleteMutation => ({
	mutation_id: uuid(),
	created_at: T0,
	type: "habit.delete",
	habit_id: habitId,
});
const restore = (habitId = LER): HabitRestoreMutation => ({
	mutation_id: uuid(),
	created_at: T0,
	type: "habit.restore",
	habit_id: habitId,
});

const server = (now = T0): ApplyContext => ({
	now,
	today: TODAY,
	newId: () => uuid(),
});
const local: ApplyContext = { now: T0, newId: () => uuid() };

describe("applyHabitDelete", () => {
	it("writes a tombstone and keeps everything else", () => {
		const archived = habit();
		const result = applyHabitDelete(archived, T0);
		expect(result).toEqual({
			habit: { ...archived, deleted_at: T0, updated_at: T0 },
			changed: true,
		});
	});

	it("requires the habit to be archived", () => {
		expect(applyHabitDelete(habit({ archived_at: null }), T0)).toBe(
			"archived_required"
		);
	});

	it("keeps the first deleted_at when deleting twice", () => {
		const deleted = habit({ deleted_at: T0 - 5 });
		expect(applyHabitDelete(deleted, T0)).toEqual({
			habit: deleted,
			changed: false,
		});
	});
});

describe("applyHabitRestore", () => {
	it("clears the tombstone and keeps the habit archived", () => {
		const deleted = habit({ deleted_at: T0 - 5, updated_at: T0 - 5 });
		expect(applyHabitRestore(deleted, T0)).toEqual({
			habit: { ...deleted, deleted_at: null, updated_at: T0 },
			changed: true,
		});
	});

	it("changes nothing on a live habit", () => {
		const live = habit();
		expect(applyHabitRestore(live, T0)).toEqual({
			habit: live,
			changed: false,
		});
	});
});

describe("applyMutation: habit.delete and habit.restore", () => {
	it("deletes an archived habit and answers its id", () => {
		const state = syncState([habit()], []);
		expect(applyMutation(state, del(), server())).toEqual({
			status: "applied",
			canonical_id: LER,
			changed: true,
		});
		expect(state.habits.get(LER)?.deleted_at).toBe(T0);
	});

	it("rejects deleting a habit that is not archived, leaving it as it was", () => {
		const live = habit({ archived_at: null });
		const state = syncState([live], []);
		expect(applyMutation(state, del(), server())).toEqual({
			status: "rejected",
			error: ARCHIVED_REQUIRED_ERROR,
		});
		expect(ARCHIVED_REQUIRED_ERROR.code).toBe("conflict");
		expect(state.habits.get(LER)).toBe(live);
	});

	it("applies a second deletion without changes", () => {
		const state = syncState([habit()], []);
		applyMutation(state, del(), server());
		expect(applyMutation(state, del(), server(T0 + 1))).toEqual({
			status: "applied",
			canonical_id: LER,
			changed: false,
		});
		expect(state.habits.get(LER)?.deleted_at).toBe(T0);
	});

	it("answers not_found for an unknown habit", () => {
		const state = syncState([], []);
		for (const mutation of [del(), restore()]) {
			expect(applyMutation(state, mutation, server())).toMatchObject({
				status: "rejected",
				error: { code: "not_found" },
			});
		}
	});

	it("restores a deleted habit, archived, and a live one stays unchanged", () => {
		const state = syncState([habit({ deleted_at: T0 - 5 })], []);
		expect(applyMutation(state, restore(), server())).toMatchObject({
			status: "applied",
			changed: true,
		});
		expect(state.habits.get(LER)).toMatchObject({
			deleted_at: null,
			archived_at: ARCHIVED_AT,
		});
		expect(applyMutation(state, restore(), server())).toMatchObject({
			status: "applied",
			changed: false,
		});
	});

	it("keeps a deleted habit out of reach of updates and completions", () => {
		const state = syncState([habit({ deleted_at: T0 - 5 })], []);
		const rename: Mutation = {
			mutation_id: uuid(),
			created_at: T0,
			type: "habit.update",
			habit_id: LER,
			changes: { archived: false },
		};
		const mark: Mutation = {
			mutation_id: uuid(),
			created_at: T0,
			type: "completion.set",
			id: uuid(),
			habit_id: LER,
			date: TODAY,
			completed: true,
		};
		expect(applyMutation(state, rename, server()).status).toBe("rejected");
		expect(applyMutation(state, mark, server()).status).toBe("rejected");
		expect(state.completions.size).toBe(0);
	});

	it("does not revive a deleted habit through a create with its id", () => {
		const deleted = habit({ deleted_at: T0 - 5 });
		const state = syncState([deleted], []);
		const outcome = applyMutation(
			state,
			{
				mutation_id: uuid(),
				created_at: T0,
				type: "habit.create",
				id: LER,
				name: "Ler",
				schedule: { type: "weekdays", days: [1] },
				start_date: TODAY,
			},
			server()
		);
		expect(outcome).toEqual({
			status: "applied",
			canonical_id: LER,
			changed: false,
		});
		expect(state.habits.get(LER)).toBe(deleted);
	});
});

describe("materialize with pending deletions", () => {
	it("hides a habit deleted on the device before it syncs", () => {
		const view = materialize(
			{ habits: [habit()], completions: [] },
			[del()],
			local
		);
		expect(view.habits.get(LER)?.deleted_at).toBe(T0);
	});

	it("shows it again after a pending delete and restore", () => {
		const view = materialize(
			{ habits: [habit()], completions: [] },
			[del(), restore()],
			local
		);
		expect(view.habits.get(LER)?.deleted_at).toBeNull();
	});

	it("skips a delete the server would reject (habit unarchived meanwhile)", () => {
		const unarchived = habit({ archived_at: null });
		const view = materialize(
			{ habits: [unarchived], completions: [] },
			[del()],
			local
		);
		expect(view.habits.get(LER)).toBe(unarchived);
	});

	it("shows a deletion pulled from another device", () => {
		const view = materialize(
			{ habits: [habit({ deleted_at: T0 - 5 })], completions: [] },
			[],
			local
		);
		expect(view.habits.get(LER)?.deleted_at).toBe(T0 - 5);
	});
});

describe("outbox order with deletions", () => {
	it("depends on its habit", () => {
		expect(habitDependency(del(CORRER))).toBe(CORRER);
		expect(habitDependency(restore(CORRER))).toBe(CORRER);
	});

	it("sends the delete of a habit created offline after its create", () => {
		const create: Mutation = {
			mutation_id: uuid(),
			created_at: T0,
			type: "habit.create",
			id: CORRER,
			name: "Correr",
			schedule: { type: "weekdays", days: [1] },
			start_date: TODAY,
		};
		const deletion = del(CORRER);
		const ordered = orderOutbox([
			{ seq: 1, mutation: deletion },
			{ seq: 2, mutation: create },
		]);
		expect(ordered.map((item) => item.mutation)).toEqual([create, deletion]);
		const blocked = blockedBy(
			[
				{ seq: 1, mutation: create },
				{ seq: 2, mutation: deletion },
				{ seq: 3, mutation: restore(CORRER) },
			],
			new Set([create.mutation_id])
		);
		expect(blocked.size).toBe(2);
		expect(blocked.get(deletion.mutation_id)).toBe(create.mutation_id);
	});
});

describe("history with a deleted habit", () => {
	// Ler: archived on 14/10, done 05-10/10. Correr: daily, live, done 05/10.
	// Conta: day 10 of the month, live, missed on 10/10 (overdue on 15/10).
	const correr = habit({
		id: CORRER,
		name: "Correr",
		archived_at: null,
		sort_key: "a1",
	});
	const conta = habit({
		id: CONTA,
		name: "Conta",
		schedule: { type: "monthly_days", days: [10] },
		start_date: "2026-09-01",
		created_at: Date.UTC(2026, 8, 1, 12),
		archived_at: null,
		sort_key: "a2",
	});
	const completions = [
		...["05", "06", "07", "08", "09", "10"].map((d) =>
			completion(LER, `2026-10-${d}`)
		),
		completion(CORRER, "2026-10-05"),
	];
	const archived = habit();
	const deleted = habit({ deleted_at: T0, updated_at: T0 });
	const restored = applyHabitRestore(deleted, T0 + 1).habit;
	const withLer = (ler: Habit) => [ler, correr, conta];
	const year = (ler: Habit) =>
		summarizeYear(withLer(ler), completions, {
			year: 2026,
			today: TODAY,
			...TZ,
		});

	it("leaves every past day as if the habit never existed", () => {
		const before = year(archived).find((d) => d.date === "2026-10-05");
		const after = year(deleted).find((d) => d.date === "2026-10-05");
		expect(before).toEqual({ date: "2026-10-05", possible: 2, completed: 2 });
		expect(after).toEqual({ date: "2026-10-05", possible: 1, completed: 1 });
		expect(
			summarizeDay(withLer(deleted), completions, "2026-10-08", TZ)
		).toEqual({ possible: 1, completed: 0 });
		const day = dayView(withLer(deleted), completions, "2026-10-08", TZ);
		expect(day.possible_habits.map((h) => h.id)).toEqual([CORRER]);
		expect(day.completed_habit_ids).toEqual([]);
	});

	it("gives the same history back once restored", () => {
		expect(year(restored)).toEqual(year(archived));
	});

	it("changes the overview numbers only through the summary", () => {
		const stats = (ler: Habit) =>
			overviewStats({ days: year(ler), today: TODAY, year: 2026 });
		expect(stats(deleted)).not.toEqual(stats(archived));
		expect(stats(restored)).toEqual(stats(archived));
	});

	it("is left out of today, the digest, the reminder count, overdue, upcoming and the year range", () => {
		// Deleted habits that were live (not archived) are covered too: the
		// rules check deleted_at first.
		const liveDeleted = habit({
			archived_at: null,
			deleted_at: T0,
			start_date: "2025-01-01",
		});
		const deletedConta = { ...conta, deleted_at: T0 };
		const habits = [liveDeleted, correr, deletedConta];
		const today = todayView(habits, completions, TODAY, TZ);
		expect(today.possible_habits.map((h) => h.id)).toEqual([CORRER]);
		expect(today.overdue).toEqual([]);
		expect(overdueOn(habits, completions, TODAY, TZ)).toEqual([]);
		expect(pendingTodayCount(habits, completions, TODAY, TZ)).toBe(1);
		const digest = selectDigestContent(habits, completions, TODAY, TZ);
		expect(digest).toMatchObject({
			todayTotal: 1,
			todayPending: 1,
			overdue: [],
		});
		expect(
			upcoming(habits, TODAY, { ...TZ, days: 30 }).map((u) => u.habit.id)
		).not.toContain(CONTA);
		// The same habit live is there: the check above is not vacuous.
		expect(
			upcoming([correr, conta], TODAY, { ...TZ, days: 30 }).map(
				(u) => u.habit.id
			)
		).toContain(CONTA);
		expect(overdueOn([correr, conta], completions, TODAY, TZ)).toHaveLength(1);
		expect(heatmapYearRange(habits, TODAY)).toEqual({
			first: 2026,
			last: 2026,
		});
		expect(
			keyAfterLast([habit({ sort_key: "z9", deleted_at: T0 }), correr])
		).toBe(keyAfterLast([correr]));
	});
});
