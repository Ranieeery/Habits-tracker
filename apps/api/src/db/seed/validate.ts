import { Completion, Habit, Schedule, UserSettings } from "@habits/contracts";
import { isHabitPossibleOn } from "@habits/core";
import type { Seed } from "./build.ts";

/**
 * Parses every seed record with its contract schema and checks the domain
 * rules the database cannot: completions only on dates their habit is
 * possible, never after today. Throws on the first problem, before any write.
 */
export function validateSeed(seed: Seed): Seed {
	const timeZone = UserSettings.parse(seed.settings).timezone;
	// Strict schedules: the seed writes only types this version knows.
	const habits = seed.habits.map((habit) =>
		Habit.extend({ schedule: Schedule }).parse(habit)
	);
	const byId = new Map(habits.map((habit) => [habit.id, habit]));
	const seen = new Set<string>();

	const completions = seed.completions.map((record) => {
		const completion = Completion.parse(record);
		const habit = byId.get(completion.habit_id);
		const key = `${completion.habit_id}:${completion.date}`;
		if (!habit) {
			throw new Error(`Seed completion ${completion.id} has no habit`);
		}
		if (seen.has(key)) {
			throw new Error(`Seed has two completions for ${key}`);
		}
		if (completion.date > seed.today) {
			throw new Error(`Seed completion ${key} is after ${seed.today}`);
		}
		if (!isHabitPossibleOn(habit, completion.date, { timeZone })) {
			throw new Error(`Seed completion ${key} is on a date not possible`);
		}
		seen.add(key);
		return completion;
	});

	return { ...seed, habits, completions };
}
