import type { SummaryDay } from "@habits/contracts";
import { dayItems } from "@habits/core";
import type { DayData } from "./repository.ts";

export interface CompletionChange {
	habitId: string;
	completed: boolean;
}

/** The day as it looks after marking a habit done or undone. */
export function withCompletion(
	day: DayData,
	{ habitId, completed }: CompletionChange
): DayData {
	const others = day.completed_habit_ids.filter((id) => id !== habitId);
	return {
		...day,
		completed_habit_ids: completed ? [...others, habitId] : others,
	};
}

/**
 * The year's summary with `day` counted as it is now (heatmap cell updated at
 * once after a toggle). Same counting as the server: completed habits among
 * the possible ones, plus an overdue habit completed today (core
 * `dayItems`: a pending overdue habit is not counted).
 */
export function withSummaryDay(
	days: readonly SummaryDay[],
	day: DayData
): SummaryDay[] {
	const entry: SummaryDay = { date: day.date, ...dayItems(day).progress };
	const others = days.filter((existing) => existing.date !== day.date);
	if (entry.possible === 0) return others;
	return [...others, entry].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : 0
	);
}
