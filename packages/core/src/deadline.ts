// Deadline tasks (2.13.0): a habit with a `deadline` schedule can be done any
// day from its start until `due_date`. Only its first live completion counts
// (`countOn` in schedule.ts): done on that day, a failure on the due date
// when nothing came before it. After the due date an open task is overdue
// (`overdueOccurrence`), for OVERDUE_DAYS like the other fixed-day habits.
import {
	type CalendarDate,
	type Completion,
	type DeadlineSchedule,
	type Habit,
	isSupportedSchedule,
	type StoredSchedule,
} from "@habits/contracts";
import { addDays, diffInDays, parseCalendarDate } from "./dates.ts";
import { MONTH_NAMES } from "./habit-draft.ts";
import { formatDayMonth } from "./schedule-text.ts";
import { MAX_DEADLINE_DAYS, type SchedulableHabit } from "./schedule.ts";
import { compareHabitOrder } from "./sort-key.ts";

/** Days after the due date an open task stays overdue (= OVERDUE_DAYS). */
const OVERDUE_WINDOW_DAYS = 15;

type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

export function deadlineOf(schedule: StoredSchedule): DeadlineSchedule | null {
	return isSupportedSchedule(schedule) && schedule.type === "deadline"
		? schedule
		: null;
}

/**
 * Each habit's earliest live completion date. Un-checking it (a tombstone)
 * promotes the next live one. Callers pass every completion of the deadline
 * tasks, whatever range they show.
 */
export function firstCompletions(
	completions: Iterable<CompletionFacts>
): Map<string, CalendarDate> {
	const first = new Map<string, CalendarDate>();
	for (const completion of completions) {
		if (completion.deleted_at !== null) continue;
		const current = first.get(completion.habit_id);
		if (current === undefined || completion.date < current) {
			first.set(completion.habit_id, completion.date);
		}
	}
	return first;
}

export interface DeadlineItem<H> {
	habit: H;
	dueDate: CalendarDate;
	completedToday: boolean;
}

/**
 * The open deadline tasks on `today` ("Com prazo"): started, not archived or
 * deleted, due today or later, and not completed before today (one completed
 * today stays, checked). By due date, then the user's order.
 */
export function deadlineOn<
	H extends SchedulableHabit & Pick<Habit, "id" | "sort_key" | "created_at">,
>(
	habits: readonly H[],
	first: ReadonlyMap<string, CalendarDate>,
	today: CalendarDate
): DeadlineItem<H>[] {
	const items: DeadlineItem<H>[] = [];
	for (const habit of habits) {
		const deadline = deadlineOf(habit.schedule);
		if (!deadline || habit.deleted_at !== null || habit.archived_at !== null) {
			continue;
		}
		if (habit.start_date > today || deadline.due_date < today) continue;
		const done = first.get(habit.id);
		if (done !== undefined && done < today) continue;
		items.push({
			habit,
			dueDate: deadline.due_date,
			completedToday: done === today,
		});
	}
	return items.sort(
		(a, b) =>
			a.dueDate.localeCompare(b.dueDate) || compareHabitOrder(a.habit, b.habit)
	);
}

export interface DeadlineLabel {
	/** Badge: "Até 20/10 · faltam 7 dias", "Vence amanhã", "Vence hoje". */
	text: string;
	/** For screen readers: "até 20 de outubro, faltam 7 dias". */
	spoken: string;
	/** Due today: the badge uses the `warning` tone. */
	dueToday: boolean;
}

/** The badge of an open task on `today` (`due` is today or later). */
export function deadlineLabel(
	due: CalendarDate,
	today: CalendarDate
): DeadlineLabel {
	const days = diffInDays(today, due);
	if (days <= 0) {
		return { text: "Vence hoje", spoken: "vence hoje", dueToday: true };
	}
	if (days === 1) {
		return { text: "Vence amanhã", spoken: "vence amanhã", dueToday: false };
	}
	const { year, month, day } = parseCalendarDate(due);
	const sameYear = parseCalendarDate(today).year === year;
	return {
		text: `Até ${formatDayMonth(due, today)} · faltam ${days} dias`,
		spoken: `até ${day} de ${MONTH_NAMES[month - 1]}${sameYear ? "" : ` de ${year}`}, faltam ${days} dias`,
		dueToday: false,
	};
}

/** "Já concluída em 22/10" for a task done on another day (2.13.0). */
export function deadlineDoneLabel(
	date: CalendarDate,
	today: CalendarDate
): { text: string; spoken: string } {
	const { year, month, day } = parseCalendarDate(date);
	const sameYear = parseCalendarDate(today).year === year;
	return {
		text: `Já concluída em ${formatDayMonth(date, today)}`,
		spoken: `já concluída em ${day} de ${MONTH_NAMES[month - 1]}${sameYear ? "" : ` de ${year}`}`,
	};
}

/**
 * Whether a deadline task left the main habits list ("Passados"): done, or
 * past its due date and its overdue window. Other habits: false.
 */
export function isDeadlineSettled(
	habit: Pick<Habit, "schedule">,
	first: CalendarDate | undefined,
	today: CalendarDate
): boolean {
	const deadline = deadlineOf(habit.schedule);
	if (!deadline) return false;
	if (first !== undefined && first <= today) return true;
	return today > addDays(deadline.due_date, OVERDUE_WINDOW_DAYS);
}

/**
 * For a day's listed deadline tasks first completed on another day (the due
 * date missed and done late): "Já concluída em DD/MM", no second completion.
 */
export function deadlineDoneElsewhere(
	listed: readonly Pick<Habit, "id" | "schedule">[],
	first: ReadonlyMap<string, CalendarDate>,
	date: CalendarDate
): { habit_id: string; date: CalendarDate }[] {
	const out: { habit_id: string; date: CalendarDate }[] = [];
	for (const habit of listed) {
		if (!deadlineOf(habit.schedule)) continue;
		const done = first.get(habit.id);
		if (done !== undefined && done !== date) {
			out.push({ habit_id: habit.id, date: done });
		}
	}
	return out;
}

/**
 * The latest due date a task created or moved on `today` may have. Used by
 * `checkHabitDates` and the forms.
 */
export function latestDueDate(today: CalendarDate): CalendarDate {
	return addDays(today, MAX_DEADLINE_DAYS);
}

/** Whether the task's due date already went by (it can no longer move). */
export function isDeadlinePast(
	schedule: StoredSchedule,
	today: CalendarDate
): boolean {
	const deadline = deadlineOf(schedule);
	return deadline !== null && deadline.due_date < today;
}
