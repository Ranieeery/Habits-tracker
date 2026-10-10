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
