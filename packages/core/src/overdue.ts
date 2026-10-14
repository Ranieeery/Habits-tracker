// Overdue fixed-day habits (2.8.0). A habit on days of the month, a single
// date or yearly that was not completed on its day shows as overdue on
// today's list for up to OVERDUE_DAYS, until it is completed (with today's
// date) or its next occurrence arrives. Counting never changes: the missed
// day keeps its failure and a late completion counts on the day it was made
// (`isHabitCountedOn`), so a pending overdue habit is never "possible" on
// the days it is only overdue. Pure: today and the time zone are parameters.
import {
	type CalendarDate,
	type Completion,
	type DayResponse,
	type Habit,
	isSupportedSchedule,
	type StoredSchedule,
} from "@habits/contracts";
import {
	addDays,
	epochDayOf,
	localDateAt,
	parseCalendarDate,
} from "./dates.ts";
import { MONTH_NAMES } from "./habit-draft.ts";
import { type DayProgress, summarizeDay } from "./progress.ts";
import {
	isHabitPossibleOn,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";
import { formatDayMonth } from "./schedule-text.ts";
import { compareHabitOrder } from "./sort-key.ts";
import { deadlineOn, firstCompletions } from "./deadline.ts";
import { dayView } from "./views.ts";

/** Days after a missed occurrence during which it shows as overdue. */
export const OVERDUE_DAYS = 15;

/**
 * Schedules on fixed days: days of the month, a single date, yearly, and
 * since 2.13.0 a deadline (its due date, with no next occurrence).
 */
export function isFixedDaySchedule(schedule: StoredSchedule): boolean {
	if (!isSupportedSchedule(schedule)) return false;
	return (
		schedule.type === "monthly_days" ||
		schedule.type === "once" ||
		schedule.type === "yearly" ||
		schedule.type === "deadline"
	);
}

/**
 * Completion dates the overdue rules read for `today`: the oldest possible
 * occurrence (`today - OVERDUE_DAYS`) up to the server's `today + 1`.
 */
export function overdueRange(today: CalendarDate): {
	from: CalendarDate;
	to: CalendarDate;
} {
	return { from: addDays(today, -OVERDUE_DAYS), to: addDays(today, 1) };
}

export type OverdueCandidate = SchedulableHabit &
	Pick<Habit, "id" | "created_at">;

export interface OverdueOccurrence {
	/** The missed occurrence. */
	since: CalendarDate;
	/** Completed today: done, but still listed (checked) as overdue. */
	completedToday: boolean;
}

/**
 * The habit's overdue occurrence on `today`, or null. `completedDates` are
 * the habit's live (not un-checked) completion dates.
 *
 * - Only fixed-day habits that are not deleted or archived.
 * - Not when the habit is possible today: the missed occurrence merges with
 *   today's (the normal item, without the overdue badge).
 * - The occurrence O is the latest possible day in `[today - OVERDUE_DAYS,
 *   today - 1]`, on or after the habit's start and its creation (local date
 *   of `created_at`), so a habit has at most one overdue item.
 * - O is fulfilled by a completion in `[O, min(O + OVERDUE_DAYS, next
 *   occurrence - 1)]`, including one made on a past day; a completion before
 *   today removes the item, one today keeps it with `completedToday`.
 */
export function overdueOccurrence(
	habit: OverdueCandidate,
	completedDates: ReadonlySet<CalendarDate>,
	today: CalendarDate,
	options: TimeZoneOptions
): OverdueOccurrence | null {
	if (habit.deleted_at !== null || habit.archived_at !== null) return null;
	if (!isFixedDaySchedule(habit.schedule)) return null;
	if (isHabitPossibleOn(habit, today, options)) return null;

	let since: CalendarDate | null = null;
	for (let back = 1; back <= OVERDUE_DAYS; back++) {
		const date = addDays(today, -back);
		if (isHabitPossibleOn(habit, date, options)) {
			since = date;
			break;
		}
	}
	if (since === null || createdAfter(habit.created_at, since, options)) {
		return null;
	}
	// A deadline task (2.13.0) is fulfilled by any completion before today,
	// also one before its due date (done in time: it never failed).
	if (
		isSupportedSchedule(habit.schedule) &&
		habit.schedule.type === "deadline"
	) {
		for (const date of completedDates) if (date < today) return null;
		return { since, completedToday: completedDates.has(today) };
	}

	let later = false;
	for (const date of completedDates) {
		if (date >= since && date < today) return null;
		if (date > today) later = true;
	}
	// A completion after today (the server accepts tomorrow) fulfills O only
	// inside its window, which ends OVERDUE_DAYS after O or the day before the
	// next occurrence (after today, since today is not possible). Rare, so the
	// next occurrence is only looked for then (CPU in the cron).
	if (later) {
		let windowEnd = addDays(since, OVERDUE_DAYS);
		for (let date = addDays(today, 1); date <= windowEnd;) {
			if (isHabitPossibleOn(habit, date, options)) {
				windowEnd = addDays(date, -1);
				break;
			}
			date = addDays(date, 1);
		}
		for (const date of completedDates) {
			if (date > today && date <= windowEnd) return null;
		}
	}
	return { since, completedToday: completedDates.has(today) };
}

/** No time zone is more than 14 hours away from UTC. */
const MAX_ZONE_OFFSET_MS = 14 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Whether the habit was created after `date` (local date of `created_at`).
 * An instant more than 14 hours before `date`'s UTC midnight is on an
 * earlier local day in every zone, which skips the `Intl` call (about 6 µs)
 * for almost every habit.
 */
function createdAfter(
	createdAt: number,
	date: CalendarDate,
	{ timeZone }: TimeZoneOptions
): boolean {
	if (createdAt < epochDayOf(date) * DAY_MS - MAX_ZONE_OFFSET_MS) return false;
	return localDateAt(createdAt, timeZone) > date;
}

type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

export interface OverdueItem<H> extends OverdueOccurrence {
	habit: H;
}

/**
 * Every overdue habit on `today`, in the user's order (`compareHabitOrder`).
 * `completions` should cover `overdueRange(today)`; deleted ones are ignored.
 */
export function overdueOn<H extends OverdueCandidate & Pick<Habit, "sort_key">>(
	habits: readonly H[],
	completions: readonly CompletionFacts[],
	today: CalendarDate,
	options: TimeZoneOptions
): OverdueItem<H>[] {
	const datesByHabit = new Map<string, Set<CalendarDate>>();
	for (const completion of completions) {
		if (completion.deleted_at !== null) continue;
		const dates = datesByHabit.get(completion.habit_id) ?? new Set();
		dates.add(completion.date);
		datesByHabit.set(completion.habit_id, dates);
	}
	const items: OverdueItem<H>[] = [];
	for (const habit of [...habits].sort(compareHabitOrder)) {
		const occurrence = overdueOccurrence(
			habit,
			datesByHabit.get(habit.id) ?? new Set(),
			today,
			options
		);
		if (occurrence) items.push({ habit, ...occurrence });
	}
	return items;
}

/**
 * The day view of the user's `today` (`dayView`) with its overdue habits:
 * what `GET /v1/day` answers for today and what the app builds locally.
 * `completions` should cover `overdueRange(today)`.
 */
export function todayView(
	habits: readonly Habit[],
	completions: readonly CompletionFacts[],
	today: CalendarDate,
	options: TimeZoneOptions
): DayResponse {
	return {
		...dayView(habits, completions, today, options),
		overdue: overdueOn(habits, completions, today, options).map((item) => ({
			habit: item.habit,
			since: item.since,
			completed_today: item.completedToday,
		})),
		// 2.13.0: open deadline tasks ("Com prazo"), by due date.
		deadline: deadlineOn(habits, firstCompletions(completions), today).map(
			(item) => ({
				habit: item.habit,
				due_date: item.dueDate,
				completed_today: item.completedToday,
			})
		),
	};
}

/**
 * Habits still to do today, for the reminder: today's pending ones
 * (`summarizeDay`) plus the overdue ones not completed today.
 */
export function pendingTodayCount(
	habits: readonly (OverdueCandidate & Pick<Habit, "sort_key">)[],
	completions: readonly CompletionFacts[],
	today: CalendarDate,
	options: TimeZoneOptions
): number {
	const { possible, completed } = summarizeDay(
		habits,
		completions,
		today,
		options
	);
	const overdue = overdueOn(habits, completions, today, options).filter(
		(item) => !item.completedToday
	);
	return possible - completed + overdue.length;
}

/** One row of a day's list. */
export interface DayItem {
	habit: Habit;
	done: boolean;
	/** The missed occurrence when the habit is overdue (today only). */
	overdueSince: CalendarDate | null;
	/** Due date of an open deadline task ("Com prazo", today only; 2.13.0). */
	dueDate: CalendarDate | null;
	/**
	 * A deadline task first completed on another day (its missed due date,
	 * done late): "Já concluída em DD/MM", without a checkbox (2.13.0).
	 */
	completedOn: CalendarDate | null;
}

export interface DayItems {
	/**
	 * Overdue habits first, then the day's habits, then the open deadline
	 * tasks ("Com prazo", by due date), each habit once.
	 */
	items: DayItem[];
	/**
	 * The day's habits plus the overdue ones completed today: a pending
	 * overdue habit is not counted (its failure stays on the missed day), the
	 * same counting as `summarizeDay`.
	 */
	progress: DayProgress;
}

/**
 * The rows of a day view (`DayResponse`, with `overdue` on today). Reads
 * completion from `completed_habit_ids` only, so an optimistic change there
 * moves both the row and the progress.
 */
export function dayItems(day: DayResponse): DayItems {
	const done = new Set(day.completed_habit_ids);
	const overdue = day.overdue ?? [];
	const deadline = day.deadline ?? [];
	const elsewhere = new Map(
		(day.deadline_done ?? []).map((item) => [item.habit_id, item.date])
	);
	const overdueIds = new Set(overdue.map((item) => item.habit.id));
	const deadlineIds = new Set(deadline.map((item) => item.habit.id));
	const items: DayItem[] = [
		...overdue.map((item) => ({
			habit: item.habit,
			done: done.has(item.habit.id),
			overdueSince: item.since,
			dueDate: null,
			completedOn: null,
		})),
		...day.possible_habits
			.filter(
				(habit) => !overdueIds.has(habit.id) && !deadlineIds.has(habit.id)
			)
			.map((habit) => ({
				habit,
				done: done.has(habit.id),
				overdueSince: null,
				dueDate: null,
				completedOn: elsewhere.get(habit.id) ?? null,
			})),
		...deadline.map((item) => ({
			habit: item.habit,
			done: done.has(item.habit.id),
			overdueSince: null,
			dueDate: item.due_date,
			completedOn: null,
		})),
	];
	// Pending overdue habits and deadline tasks not yet due do not count (the
	// same counting as `summarizeDay`): done ones and tasks due today do.
	const counted = items.filter((item) =>
		item.overdueSince !== null
			? item.done
			: item.dueDate !== null
				? item.done || item.dueDate === day.date
				: true
	);
	return {
		items,
		progress: {
			possible: counted.length,
			completed: counted.filter((item) => item.done).length,
		},
	};
}

export interface OverdueLabel {
	/** Badge text: "Atrasado desde 11/10" (with the year when it differs). */
	text: string;
	/** For screen readers: "atrasado desde 11 de outubro". */
	spoken: string;
}

export function overdueLabel(
	since: CalendarDate,
	today: CalendarDate
): OverdueLabel {
	const { year, month, day } = parseCalendarDate(since);
	const sameYear = parseCalendarDate(today).year === year;
	return {
		text: `Atrasado desde ${formatDayMonth(since, today)}`,
		spoken: `atrasado desde ${day} de ${MONTH_NAMES[month - 1]}${sameYear ? "" : ` de ${year}`}`,
	};
}

/**
 * When nothing counts today yet (`progress.possible === 0`) but the list has
 * overdue habits or open deadline tasks: what to say instead of "0 de 0".
 */
export function extrasOnlyText(items: readonly DayItem[]): string {
	const overdue = items.some((item) => item.overdueSince !== null);
	const deadline = items.some((item) => item.dueDate !== null);
	if (overdue && deadline) {
		return "Nada previsto para hoje além dos atrasados e das tarefas com prazo.";
	}
	return deadline
		? "Nada previsto para hoje além das tarefas com prazo."
		: "Nada previsto para hoje além dos atrasados.";
}
