import type { SummaryDay } from "@habits/contracts";
import { type CalendarDate, eachDay } from "./dates.ts";
import {
	isHabitCountedOn,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";

export interface Streaks {
	/** Consecutive possible days done, ending today (or yesterday's run). */
	current: number;
	longest: number;
}

export interface ComputeStreaksInput {
	/** First date to consider (inclusive). */
	from: CalendarDate;
	/** The user's local date; later dates are ignored. */
	today: CalendarDate;
	isPossible: (date: CalendarDate) => boolean;
	isDone: (date: CalendarDate) => boolean;
}

/**
 * Generic streak counter. Days that are not possible are skipped and neither
 * extend nor break a streak. Today only breaks the current streak once it is
 * over, so a possible-but-not-done today leaves the current streak intact.
 */
export function computeStreaks({
	from,
	today,
	isPossible,
	isDone,
}: ComputeStreaksInput): Streaks {
	let run = 0;
	let longest = 0;

	for (const date of eachDay(from, today)) {
		if (!isPossible(date)) continue;
		if (isDone(date)) {
			run += 1;
			longest = Math.max(longest, run);
		} else if (date !== today) {
			run = 0;
		}
	}
	return { current: run, longest };
}

/** Streaks of one habit, from its start date to today. */
export function habitStreaks(
	habit: SchedulableHabit,
	completedDates: Iterable<CalendarDate>,
	today: CalendarDate,
	options: TimeZoneOptions
): Streaks {
	const done = new Set(completedDates);
	return computeStreaks({
		from: habit.start_date,
		today,
		isPossible: (date) =>
			isHabitCountedOn(habit, date, done.has(date), options),
		isDone: (date) => done.has(date),
	});
}

/**
 * Streaks of "perfect days": every possible habit completed. Days with nothing
 * possible are skipped. Counts from the earliest summary day.
 */
export function dayStreaks(
	summary: readonly SummaryDay[],
	today: CalendarDate
): Streaks {
	if (summary.length === 0) return { current: 0, longest: 0 };
	const byDate = new Map(summary.map((day) => [day.date, day]));
	const from = summary.reduce(
		(min, day) => (day.date < min ? day.date : min),
		summary[0]!.date
	);
	return computeStreaks({
		from,
		today,
		isPossible: (date) => (byDate.get(date)?.possible ?? 0) > 0,
		isDone: (date) => {
			const day = byDate.get(date);
			return day !== undefined && day.completed >= day.possible;
		},
	});
}
