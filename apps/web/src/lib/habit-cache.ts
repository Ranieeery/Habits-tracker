// Optimistic changes to one habit across the cached habits list and every
// cached day (2.15.0, the day rows' actions menu). The server recomputes what
// is possible afterwards (`invalidateHabitData`); these only make the change
// show at once and can be put back on failure.
import type { CalendarDate, DayResponse, Habit } from "@habits/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queries.ts";

export interface HabitCacheSnapshot {
	habits: Habit[] | undefined;
	days: [readonly unknown[], DayResponse | undefined][];
}

export async function snapshotHabitCaches(
	queryClient: QueryClient
): Promise<HabitCacheSnapshot> {
	await Promise.all([
		queryClient.cancelQueries({ queryKey: queryKeys.habits }),
		queryClient.cancelQueries({ queryKey: queryKeys.days }),
	]);
	return {
		habits: queryClient.getQueryData<Habit[]>(queryKeys.habits),
		days: queryClient.getQueriesData<DayResponse>({
			queryKey: queryKeys.days,
		}),
	};
}

export function restoreHabitCaches(
	queryClient: QueryClient,
	snapshot: HabitCacheSnapshot
) {
	if (snapshot.habits) {
		queryClient.setQueryData(queryKeys.habits, snapshot.habits);
	}
	for (const [key, day] of snapshot.days) {
		queryClient.setQueryData(key, day);
	}
}

/** Rewrites the habit wherever it is cached. */
export function patchHabitInCaches(
	queryClient: QueryClient,
	habitId: string,
	patch: (habit: Habit) => Habit
) {
	const apply = (habit: Habit) => (habit.id === habitId ? patch(habit) : habit);
	queryClient.setQueryData<Habit[]>(queryKeys.habits, (habits) =>
		habits?.map(apply)
	);
	queryClient.setQueriesData<DayResponse>(
		{ queryKey: queryKeys.days },
		(day) =>
			day && {
				...day,
				possible_habits: day.possible_habits.map(apply),
				...(day.overdue && {
					overdue: day.overdue.map((item) => ({
						...item,
						habit: apply(item.habit),
					})),
				}),
				...(day.deadline && {
					deadline: day.deadline.map((item) => ({
						...item,
						habit: apply(item.habit),
					})),
				}),
			}
	);
}

/**
 * Archiving as the server will see it (core `isHabitPossibleOn`): today and
 * past days keep the habit (marked archived), later days lose it, and it
 * leaves the overdue list and "Com prazo" at once.
 */
export function archiveHabitInCaches(
	queryClient: QueryClient,
	habitId: string,
	archivedAt: number,
	today: CalendarDate
) {
	patchHabitInCaches(queryClient, habitId, (habit) => ({
		...habit,
		archived_at: habit.archived_at ?? archivedAt,
	}));
	queryClient.setQueriesData<DayResponse>(
		{ queryKey: queryKeys.days },
		(day) =>
			day && {
				...day,
				possible_habits:
					day.date > today
						? day.possible_habits.filter((habit) => habit.id !== habitId)
						: day.possible_habits,
				...(day.overdue && {
					overdue: day.overdue.filter((item) => item.habit.id !== habitId),
				}),
				...(day.deadline && {
					deadline: day.deadline.filter((item) => item.habit.id !== habitId),
				}),
			}
	);
}
