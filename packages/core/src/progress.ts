import type { Completion, Habit } from "@habits/contracts";
import type { CalendarDate } from "./dates.ts";
import {
	isHabitPossibleOn,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";

/** Heatmap intensity levels, 0 (nothing done) to 5. */
export const HEATMAP_LEVEL_COUNT = 6;

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Share of possible habits completed, in [0, 1]; 0 when nothing is possible. */
export function completionRatio(completed: number, possible: number): number {
	if (possible <= 0 || completed <= 0) return 0;
	return Math.min(1, completed / possible);
}

/**
 * Heatmap level for a ratio: 0 for nothing done, then one level per 20%
 * (level 1 is anything above 0 and below 20%, level 5 is 80% or more).
 */
export function heatmapLevel(ratio: number): HeatmapLevel {
	if (!(ratio > 0)) return 0;
	if (ratio >= 0.8) return 5;
	return (Math.floor(ratio * 5) + 1) as HeatmapLevel;
}

export interface DayProgress {
	possible: number;
	completed: number;
}

/**
 * Counts the habits possible on `date` and how many of them were completed.
 * Deleted completions and completions of habits not possible that day are
 * ignored.
 */
export function summarizeDay(
	habits: readonly (SchedulableHabit & Pick<Habit, "id">)[],
	completions: readonly Pick<Completion, "habit_id" | "date" | "deleted_at">[],
	date: CalendarDate,
	options: TimeZoneOptions
): DayProgress {
	const possibleIds = new Set(
		habits
			.filter((habit) => isHabitPossibleOn(habit, date, options))
			.map((habit) => habit.id)
	);
	const completedIds = new Set(
		completions
			.filter(
				(completion) =>
					completion.date === date &&
					completion.deleted_at === null &&
					possibleIds.has(completion.habit_id)
			)
			.map((completion) => completion.habit_id)
	);
	return { possible: possibleIds.size, completed: completedIds.size };
}
