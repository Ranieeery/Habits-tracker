// `HabitsRepository` over the local database. Reads replay the outbox over
// the server mirror (`materialize`); writes add one mutation to the outbox and
// ask the sync engine to send it. Settings stay on the server (they need it to
// be useful: time zone, reminders) with a local copy for offline reads.
import {
	type Habit,
	HabitCreateMutation,
	HabitUpdateMutation,
	type Mutation,
	type UserSettings,
} from "@habits/contracts";
import {
	addDays,
	applyHabitChanges,
	applyHabitDelete,
	applyHabitRestore,
	ARCHIVED_REQUIRED_ERROR,
	BACKFILL_DAYS,
	completionKey,
	dayView,
	firstDayOfYear,
	isWithinWriteWindow,
	keyAfterLast,
	lastDayOfYear,
	materialize,
	newHabit,
	overdueRange,
	sortHabits,
	summarizeYear,
	todayIn,
	todayView,
} from "@habits/core";
import { DataError } from "../errors.ts";
import type { HabitsRepository } from "../repository.ts";
import type { DateRange, LocalStore } from "./store.ts";

export interface LocalRepositoryDeps {
	store: LocalStore;
	/** Where settings come from when there is no local copy, and where they go. */
	remoteSettings: Pick<HabitsRepository, "getSettings" | "updateSettings">;
	now: () => number;
	newId: () => string;
	/** Called after each local write (the sync engine schedules a push). */
	onWrite: () => void;
}

function invalid(error: unknown): DataError {
	return new DataError("invalid", "Invalid data", { cause: error });
}

export function createLocalRepository({
	store,
	remoteSettings,
	now,
	newId,
	onWrite,
}: LocalRepositoryDeps): HabitsRepository {
	async function settings(): Promise<UserSettings> {
		const cached = await store.getSettings();
		if (cached) return cached;
		const fresh = await remoteSettings.getSettings();
		await store.setSettings(fresh);
		return fresh;
	}

	/** Server records plus the changes not yet confirmed by a full pull. */
	async function view(range: DateRange | "habits") {
		const [mirror, outbox] = await Promise.all([
			store.readMirror(range),
			store.readOutbox(),
		]);
		const replay = outbox
			.filter((entry) => entry.state !== "failed")
			.map((entry) => entry.mutation);
		const state = materialize(mirror, replay, { now: now(), newId });
		const habits = [...state.habits.values()];
		const completions = [...state.completions.values()].filter(
			(completion) =>
				range !== "habits" &&
				completion.date >= range.from &&
				completion.date <= range.to
		);
		return { habits, completions, state };
	}

	async function write(mutation: Mutation) {
		await store.enqueue(mutation, now());
		onWrite();
	}

	return {
		getSettings: settings,
		async updateSettings(changes) {
			const updated = await remoteSettings.updateSettings(changes);
			await store.setSettings(updated);
			return updated;
		},

		async listHabits() {
			const { habits } = await view("habits");
			// The user's order (2.4.0), the same as the API's.
			return sortHabits(habits.filter((habit) => habit.deleted_at === null));
		},
		async createHabit(input) {
			const { timezone } = await settings();
			const at = now();
			const earliest = addDays(todayIn(timezone, at), -BACKFILL_DAYS);
			if (input.start_date < earliest) {
				throw new DataError("out_of_range", "start_date is too old");
			}
			// Last in the list, already before it syncs.
			const { habits } = await view("habits");
			const parsed = HabitCreateMutation.safeParse({
				mutation_id: newId(),
				created_at: at,
				type: "habit.create",
				id: input.id ?? newId(),
				name: input.name,
				...(input.description && { description: input.description }),
				schedule: input.schedule,
				start_date: input.start_date,
				sort_key: input.sort_key ?? keyAfterLast(habits),
			});
			if (!parsed.success) throw invalid(parsed.error);
			await write(parsed.data);
			return newHabit(
				{
					...parsed.data,
					sort_key: parsed.data.sort_key ?? keyAfterLast(habits),
				},
				at
			);
		},
		async updateHabit(habitId, changes): Promise<Habit> {
			const { state } = await view("habits");
			const habit = state.habits.get(habitId);
			if (!habit || habit.deleted_at !== null) {
				throw new DataError("not_found", "Habit not found");
			}
			const at = now();
			const parsed = HabitUpdateMutation.safeParse({
				mutation_id: newId(),
				created_at: at,
				type: "habit.update",
				habit_id: habitId,
				changes,
			});
			if (!parsed.success) throw invalid(parsed.error);
			const result = applyHabitChanges(habit, parsed.data.changes, at);
			if (result.changed) await write(parsed.data);
			return result.habit;
		},

		async deleteHabit(habitId): Promise<Habit> {
			const { state } = await view("habits");
			const habit = state.habits.get(habitId);
			if (!habit) throw new DataError("not_found", "Habit not found");
			const at = now();
			const result = applyHabitDelete(habit, at);
			if (result === "archived_required") {
				throw new DataError("conflict", ARCHIVED_REQUIRED_ERROR.message);
			}
			if (result.changed) {
				await write({
					mutation_id: newId(),
					created_at: at,
					type: "habit.delete",
					habit_id: habitId,
				});
			}
			return result.habit;
		},
		async restoreHabit(habitId): Promise<Habit> {
			const { state } = await view("habits");
			const habit = state.habits.get(habitId);
			if (!habit) throw new DataError("not_found", "Habit not found");
			const at = now();
			const result = applyHabitRestore(habit, at);
			if (result.changed) {
				await write({
					mutation_id: newId(),
					created_at: at,
					type: "habit.restore",
					habit_id: habitId,
				});
			}
			return result.habit;
		},

		async getDay(date) {
			const { timezone } = await settings();
			// Today also lists the overdue fixed-day habits (2.8.0), from the
			// local completions of the last OVERDUE_DAYS, like the API does.
			if (date === todayIn(timezone, now())) {
				const { habits, completions } = await view(overdueRange(date));
				return todayView(sortHabits(habits), completions, date, {
					timeZone: timezone,
				});
			}
			const { habits, completions } = await view({ from: date, to: date });
			return dayView(sortHabits(habits), completions, date, {
				timeZone: timezone,
			});
		},
		async getYearSummary(year, { habitId } = {}) {
			const { timezone } = await settings();
			const today = todayIn(timezone, now());
			const all = await view({
				from: firstDayOfYear(year),
				to: lastDayOfYear(year),
			});
			// One habit: core's year view over that habit and its completions.
			const habits = habitId
				? all.habits.filter((habit) => habit.id === habitId)
				: all.habits;
			const completions = habitId
				? all.completions.filter(
						(completion) => completion.habit_id === habitId
					)
				: all.completions;
			return summarizeYear(habits, completions, {
				year,
				today,
				timeZone: timezone,
			});
		},
		async setCompletion(habitId, date, completed) {
			const { timezone } = await settings();
			const at = now();
			if (!isWithinWriteWindow(date, todayIn(timezone, at))) {
				throw new DataError("out_of_range", "Date outside the write window");
			}
			const { state } = await view({ from: date, to: date });
			const habit = state.habits.get(habitId);
			if (!habit || habit.deleted_at !== null) {
				throw new DataError("not_found", "Habit not found");
			}
			const current = state.completions.get(completionKey(habitId, date));
			// Already in that state: nothing to send.
			if (current && (current.deleted_at === null) === completed) return;
			await write({
				mutation_id: newId(),
				created_at: at,
				type: "completion.set",
				id: current?.id ?? newId(),
				habit_id: habitId,
				date,
				completed,
			});
		},
	};
}
