// The heatmap's preview of the next days (2.14.0): which dates are in it and
// what a preview day lists. The content is `dayView`'s, the same function
// every other day uses; nothing here counts toward any statistic.
import type { CalendarDate, DayResponse, Habit } from "@habits/contracts";
import { addDays } from "./dates.ts";
import { deadlineOf } from "./deadline.ts";
import type { ScheduleOptions } from "./schedule.ts";
import { movedInFields } from "./overdue.ts";
import { dayView } from "./views.ts";

/** Days after today the heatmap shows as read-only future cells. */
export const PREVIEW_DAYS = 7;

/** The last date of the preview: `today + days`. */
export function previewEnd(
	today: CalendarDate,
	days: number = PREVIEW_DAYS
): CalendarDate {
	return addDays(today, days);
}

/** Whether `date` is in `[today + 1, today + days]`. */
export function isPreviewDate(
	date: CalendarDate,
	today: CalendarDate,
	days: number = PREVIEW_DAYS
): boolean {
	return date > today && date <= previewEnd(today, days);
}

/**
 * The day view of a preview date for a client that has the habits and each
 * deadline task's first completion but not every completion (the web): for
 * a day that has not happened, only those first completions change what is
 * listed (a task already done is not due any more).
 */
export function previewDayView(
	habits: readonly Habit[],
	deadlineFirsts: Readonly<Record<string, CalendarDate>>,
	date: CalendarDate,
	options: ScheduleOptions
): DayResponse {
	const completions = Object.entries(deadlineFirsts).map(
		([habit_id, first]) => ({ habit_id, date: first, deleted_at: null })
	);
	// 2.16.0: the postponed occurrences come in `options.reschedules`, built
	// with the completions of their habits (an early completion settles one).
	return dayView(habits, completions, date, options);
}

/** One row of a preview day. */
export interface PreviewItem {
	habit: Habit;
	/** A deadline task due on this day ("Vence neste dia"). */
	dueOnDay: boolean;
	/** 2.16.0: a postponed occurrence's nominal date ("Adiado de 20/10"). */
	rescheduledFrom?: CalendarDate;
	/** Its live postponements (absent = 0). */
	rescheduleCount?: number;
}

/**
 * The rows of a preview day, from its `dayView` (the habits that occur that
 * day, in the user's order). Read only: no completion state.
 */
export function previewItems(day: DayResponse): PreviewItem[] {
	const movedIn = new Map(
		(day.moved_in ?? []).map((item) => [item.habit_id, item])
	);
	return day.possible_habits.map((habit) => ({
		habit,
		dueOnDay: deadlineOf(habit.schedule)?.due_date === day.date,
		...movedInFields(movedIn.get(habit.id)),
	}));
}
