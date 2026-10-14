// The day and year views both the API (`GET /v1/day`, `GET /v1/summary`) and
// the mobile app (from its local database) build from habits and completions.
import type {
	CalendarDate,
	Completion,
	DayResponse,
	Habit,
	SummaryDay,
} from "@habits/contracts";
import { eachDay, firstDayOfYear, lastDayOfYear } from "./dates.ts";
import { deadlineDoneElsewhere, firstCompletions } from "./deadline.ts";
import { summarizeDay } from "./progress.ts";
import { countOn, type TimeZoneOptions } from "./schedule.ts";

type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

/**
 * Habits that count on `date` (possible, or completed that day:
 * `isHabitCountedOn`) and which of them were completed.
 */
export function dayView(
	habits: readonly Habit[],
	completions: readonly CompletionFacts[],
	date: CalendarDate,
	options: TimeZoneOptions
): DayResponse {
	const first = firstCompletions(completions);
	const done = new Set(
		completions
			.filter(
				(completion) =>
					completion.date === date && completion.deleted_at === null
			)
			.map((completion) => completion.habit_id)
	);
	const counts = habits.map(
		(habit) =>
			[
				habit,
				countOn(
					habit,
					date,
					done.has(habit.id),
					options,
					first.get(habit.id) ?? null
				),
			] as const
	);
	const possible = counts
		.filter(([, count]) => count.counted)
		.map(([habit]) => habit);
	const elsewhere = deadlineDoneElsewhere(possible, first, date);
	return {
		date,
		possible_habits: possible,
		completed_habit_ids: counts
			.filter(([, count]) => count.done)
			.map(([habit]) => habit.id),
		// 2.13.0: a missed due date whose task was done later.
		...(elsewhere.length > 0 && { deadline_done: elsewhere }),
	};
}

export interface YearSummaryOptions extends TimeZoneOptions {
	year: number;
	/** The user's today: later dates are left out. */
	today: CalendarDate;
}

/**
 * Completed/possible counts for every date of `year` up to `today` with at
 * least one possible habit.
 */
export function summarizeYear(
	habits: readonly Habit[],
	completions: readonly CompletionFacts[],
	{ year, today, timeZone }: YearSummaryOptions
): SummaryDay[] {
	const from = firstDayOfYear(year);
	const yearEnd = lastDayOfYear(year);
	const to = today < yearEnd ? today : yearEnd;
	if (to < from) return [];

	// Deadline tasks count through their first completion, which may be
	// outside the year (callers pass all of their completions).
	const first = firstCompletions(completions);
	const byDate = new Map<CalendarDate, CompletionFacts[]>();
	for (const completion of completions) {
		if (completion.date < from || completion.date > to) continue;
		const list = byDate.get(completion.date) ?? [];
		list.push(completion);
		byDate.set(completion.date, list);
	}
	const days: SummaryDay[] = [];
	for (const date of eachDay(from, to)) {
		const progress = summarizeDay(
			habits,
			byDate.get(date) ?? [],
			date,
			{ timeZone },
			first
		);
		if (progress.possible > 0) days.push({ date, ...progress });
	}
	return days;
}
