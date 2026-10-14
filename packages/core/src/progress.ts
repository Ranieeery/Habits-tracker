import type { Completion, Habit } from "@habits/contracts";
import type { CalendarDate } from "./dates.ts";
import { firstCompletions } from "./deadline.ts";
import {
	countOn,
	type SchedulableHabit,
	type ScheduleOptions,
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
 * Counts the habits that count on `date` (`isHabitCountedOn`: possible, or
 * completed that day) and how many of them were completed, so the ratio is
 * never above 1. Deleted completions and deleted habits are ignored. A
 * deadline task counts through its first completion (`first`, 2.13.0),
 * read from `completions` unless given: pass every completion of the
 * deadline tasks, not only this date's.
 */
export function summarizeDay(
	habits: readonly (SchedulableHabit & Pick<Habit, "id">)[],
	completions: readonly Pick<Completion, "habit_id" | "date" | "deleted_at">[],
	date: CalendarDate,
	options: ScheduleOptions,
	first: ReadonlyMap<string, CalendarDate> = firstCompletions(completions)
): DayProgress {
	const done = new Set(
		completions
			.filter(
				(completion) =>
					completion.date === date && completion.deleted_at === null
			)
			.map((completion) => completion.habit_id)
	);
	let possible = 0;
	let completed = 0;
	for (const habit of habits) {
		const count = countOn(
			habit,
			date,
			done.has(habit.id),
			options,
			first.get(habit.id) ?? null
		);
		if (!count.counted) continue;
		possible += 1;
		if (count.done) completed += 1;
	}
	return { possible, completed };
}
