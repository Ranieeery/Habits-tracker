// Postponing one occurrence of a fixed-day habit (2.16.0): a single date or
// one day of a days-of-the-month habit moves to a later date without leaving
// a failure on its nominal date. The rules here are the only ones: the API
// (REST and sync), the web and the mobile app all call `checkReschedule` and
// `checkRescheduleUndo`. Pure: today and the time zone are parameters.
import type {
	ApiErrorBody,
	CalendarDate,
	HabitReschedule,
	StoredSchedule,
} from "@habits/contracts";
import { addDays, parseCalendarDate } from "./dates.ts";
import { MONTH_NAMES } from "./habit-draft.ts";
import {
	isMoveValid,
	isReschedulableSchedule,
	movesOf,
	nextNominalAfter,
	type OccurrenceMove,
	type RescheduleFacts,
	type RescheduleIndex,
} from "./reschedule-index.ts";
import type { SchedulableHabit } from "./schedule.ts";
import { matchesSchedule } from "./schedule-match.ts";
import { formatDayMonth } from "./schedule-text.ts";

/** Postponements per occurrence. */
export const MAX_RESCHEDULES = 2;

/** Latest new date, in days after today. */
export const RESCHEDULE_MAX_DAYS = 90;

export type RescheduleProblem =
	/** Not a single date or days of the month. */
	| "not_reschedulable"
	| "archived"
	/** The nominal date is not an occurrence of the habit's schedule. */
	| "not_an_occurrence"
	/** Already fulfilled (a completion from its nominal date on). */
	| "already_done"
	/** Its effective date went by: it is overdue now, never postponed. */
	| "occurrence_passed"
	| "limit_reached"
	/** The client saw another state (another device postponed it). */
	| "stale"
	/** The new date is not after the effective date and today. */
	| "not_later"
	/** More than `RESCHEDULE_MAX_DAYS` after today. */
	| "too_far"
	/** Days of the month: on or after the next nominal occurrence. */
	| "crosses_next";

export type RescheduleUndoProblem =
	| "archived"
	/** A later postponement of the same occurrence is live. */
	| "not_last"
	/** The date it would go back to already went by (no failure afterwards). */
	| "undo_passed";

/** The habit fields the rules read. */
export type ReschedulableHabit = SchedulableHabit;

export interface OccurrenceState {
	original: CalendarDate;
	/** E: the occurrence's date now. */
	effective: CalendarDate;
	/** Live postponements. */
	count: number;
	/** The live row with the highest sequence, if any. */
	last: RescheduleFacts | null;
}

/** An occurrence's effective date and count, from its live rows. */
export function occurrenceState(
	rows: Iterable<RescheduleFacts>,
	habitId: string,
	original: CalendarDate
): OccurrenceState {
	let last: RescheduleFacts | null = null;
	let count = 0;
	for (const row of rows) {
		if (
			row.deleted_at !== null ||
			row.habit_id !== habitId ||
			row.original_date !== original
		) {
			continue;
		}
		count += 1;
		if (last === null || row.sequence > last.sequence) last = row;
	}
	return { original, effective: last?.to_date ?? original, count, last };
}

/** Why the latest allowed date is what it is. */
export type RescheduleLimit = "days" | "next";

export interface RescheduleBounds {
	/** The earliest new date: the day after the effective date and today. */
	min: CalendarDate;
	max: CalendarDate;
	/** `next`: the day before the next occurrence; `days`: today + 90. */
	limit: RescheduleLimit;
	/** The next nominal occurrence (days of the month). */
	next: CalendarDate | null;
}

/**
 * The dates an occurrence may move to, or null when there is none (days of
 * the month so close together that the next one comes right after).
 */
export function rescheduleBounds(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	occurrence: Pick<OccurrenceState, "original" | "effective">,
	today: CalendarDate
): RescheduleBounds | null {
	const after = occurrence.effective > today ? occurrence.effective : today;
	const min = addDays(after, 1);
	const byDays = addDays(today, RESCHEDULE_MAX_DAYS);
	const next = nextNominalAfter(habit, occurrence.original);
	const beforeNext = next === null ? null : addDays(next, -1);
	const bounds: RescheduleBounds =
		beforeNext !== null && beforeNext < byDays
			? { min, max: beforeNext, limit: "next", next }
			: { min, max: byDays, limit: "days", next };
	return bounds.min <= bounds.max ? bounds : null;
}

/**
 * Whether the occurrence is fulfilled: a live completion from its nominal
 * date up to its effective date (or tomorrow, the server's +1, when it is
 * today), never reaching the next occurrence.
 */
function isFulfilled(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	occurrence: Pick<OccurrenceState, "original" | "effective">,
	completedDates: Iterable<CalendarDate>,
	today: CalendarDate
): boolean {
	const tomorrow = addDays(today, 1);
	let end = occurrence.effective > tomorrow ? occurrence.effective : tomorrow;
	const next = nextNominalAfter(habit, occurrence.original);
	if (next !== null && end >= next) end = addDays(next, -1);
	for (const date of completedDates) {
		if (date >= occurrence.original && date <= end) return true;
	}
	return false;
}

export interface RescheduleRequest {
	original_date: CalendarDate;
	from_date: CalendarDate;
	to_date: CalendarDate;
	sequence: number;
}

export interface RescheduleCheckInput {
	habit: ReschedulableHabit;
	/** The habit's postponement rows (tombstones are ignored). */
	rows: Iterable<RescheduleFacts>;
	/** The habit's live completion dates. */
	completedDates: Iterable<CalendarDate>;
	request: RescheduleRequest;
	/** The user's today (offline: the device's local date of the action). */
	today: CalendarDate;
}

/**
 * The one validation of a postponement (rules 1 and 2 of 2.16.0), or null
 * when it may be written. Deleted habits are the caller's `not_found`.
 */
export function checkReschedule({
	habit,
	rows,
	completedDates,
	request,
	today,
}: RescheduleCheckInput): RescheduleProblem | null {
	if (!isReschedulableSchedule(habit.schedule)) return "not_reschedulable";
	if (habit.archived_at !== null) return "archived";
	const original = request.original_date;
	if (original < habit.start_date || !matchesSchedule(habit.schedule, original))
		return "not_an_occurrence";
	const state = occurrenceState(rows, habit.id, original);
	if (state.count >= MAX_RESCHEDULES) return "limit_reached";
	if (
		request.from_date !== state.effective ||
		request.sequence !== state.count + 1
	) {
		return "stale";
	}
	if (state.count > 0 && !isMoveValid(habit, state)) return "stale";
	if (state.effective < today) return "occurrence_passed";
	if (isFulfilled(habit, state, completedDates, today)) return "already_done";
	if (request.to_date <= state.effective || request.to_date <= today)
		return "not_later";
	const bounds = rescheduleBounds(habit, state, today);
	if (bounds === null) return "crosses_next";
	if (request.to_date > bounds.max) {
		return bounds.limit === "next" ? "crosses_next" : "too_far";
	}
	return null;
}

export interface RescheduleUndoInput {
	habit: Pick<SchedulableHabit, "archived_at">;
	rows: Iterable<RescheduleFacts>;
	/** The row to undo (live). */
	row: RescheduleFacts;
	today: CalendarDate;
}

/**
 * Whether the last postponement of an occurrence can be undone: only the
 * live row with the highest sequence, and only while the date it brings the
 * occurrence back to is today or later (undoing later would put a failure
 * back on a past day). A tombstoned row is the caller's no-op.
 */
export function checkRescheduleUndo({
	habit,
	rows,
	row,
	today,
}: RescheduleUndoInput): RescheduleUndoProblem | null {
	if (habit.archived_at !== null) return "archived";
	const state = occurrenceState(rows, row.habit_id, row.original_date);
	if (state.last?.id !== row.id) return "not_last";
	if (row.from_date < today) return "undo_passed";
	return null;
}

/** A new live row, stamped with the server's (or the device's) instant. */
export function newReschedule(
	input: RescheduleRequest & { id: string; habit_id: string },
	now: number
): HabitReschedule {
	return {
		id: input.id,
		habit_id: input.habit_id,
		original_date: input.original_date,
		from_date: input.from_date,
		to_date: input.to_date,
		sequence: input.sequence,
		created_at: now,
		updated_at: now,
		deleted_at: null,
	};
}

/** The undo: a tombstone (the first `deleted_at` stays). */
export function undoReschedule(
	row: HabitReschedule,
	now: number
): { row: HabitReschedule; changed: boolean } {
	if (row.deleted_at !== null) return { row, changed: false };
	return { row: { ...row, deleted_at: now, updated_at: now }, changed: true };
}

/** The API error of a problem (REST and sync answer the same). */
export function rescheduleError(
	problem: RescheduleProblem | RescheduleUndoProblem,
	bounds?: RescheduleBounds | null
): ApiErrorBody {
	const details = { reason: problem };
	switch (problem) {
		case "limit_reached":
			return {
				code: "conflict",
				message: "This occurrence was already postponed twice",
				details,
			};
		case "stale":
			return {
				code: "conflict",
				message: "The occurrence changed (postponed on another device)",
				details,
			};
		case "not_last":
			return {
				code: "conflict",
				message: "Only the last postponement can be undone",
				details,
			};
		case "too_far":
		case "crosses_next":
			return {
				code: "date_out_of_range",
				message: "New date is too far ahead",
				details: { ...details, latest: bounds?.max },
			};
		case "occurrence_passed":
			return {
				code: "date_out_of_range",
				message: "The occurrence already went by",
				details,
			};
		case "undo_passed":
			return {
				code: "date_out_of_range",
				message: "The previous date already went by",
				details,
			};
		case "not_reschedulable":
		case "archived":
		case "not_an_occurrence":
		case "already_done":
		case "not_later":
			return {
				code: "validation_error",
				message: "This occurrence cannot be postponed to that date",
				details,
			};
		default: {
			const unknown: never = problem;
			throw new Error(`Unknown problem: ${String(unknown)}`);
		}
	}
}

const PROBLEMS = new Set<string>([
	"not_reschedulable",
	"archived",
	"not_an_occurrence",
	"already_done",
	"occurrence_passed",
	"limit_reached",
	"stale",
	"not_later",
	"too_far",
	"crosses_next",
	"not_last",
	"undo_passed",
]);

/** Whether an error's `details.reason` is a postponement problem. */
export function isRescheduleProblem(reason: unknown): boolean {
	return typeof reason === "string" && PROBLEMS.has(reason);
}

/** The pt-BR sentence of a problem (failures list, dialog errors). */
export function rescheduleProblemText(
	problem: string,
	today?: CalendarDate,
	latest?: CalendarDate
): string {
	switch (problem) {
		case "not_reschedulable":
			return "Só dá para adiar hábitos de data única ou de dias do mês.";
		case "archived":
			return "O hábito está arquivado.";
		case "not_an_occurrence":
			return "Essa data não é mais uma ocorrência do hábito.";
		case "already_done":
			return "Essa ocorrência já foi feita.";
		case "occurrence_passed":
			return "O dia da ocorrência já passou.";
		case "limit_reached":
			return LIMIT_REACHED_TEXT;
		case "stale":
			return "A ocorrência mudou em outro aparelho.";
		case "not_later":
			return "A data nova precisa ser depois do dia atual da ocorrência e de hoje.";
		case "too_far":
			return latest
				? `A data nova pode ir no máximo até ${formatDayMonth(latest, today)}.`
				: `A data nova pode ir no máximo ${RESCHEDULE_MAX_DAYS} dias à frente.`;
		case "crosses_next":
			return latest
				? `A data nova precisa ser até ${formatDayMonth(latest, today)}, antes da próxima ocorrência.`
				: "A data nova precisa ser antes da próxima ocorrência.";
		case "not_last":
			return "Só o último adiamento pode ser desfeito.";
		case "undo_passed":
			return "Não dá mais para desfazer: o dia anterior já passou.";
		default:
			return "Não foi possível adiar.";
	}
}

export const LIMIT_REACHED_TEXT = `Limite de ${MAX_RESCHEDULES} adiamentos atingido`;

/** The menu item's state on a row (2.16.0, `habitActions`). */
export type RescheduleAvailability =
	| { state: "hidden" }
	| { state: "enabled" }
	| { state: "disabled"; reason: string };

export interface RescheduleRowContext {
	/** The day shown. */
	date: CalendarDate;
	today: CalendarDate;
	/** The row is an overdue item (`overdueSince`). */
	overdue: boolean;
	/** Done on the day shown. */
	done: boolean;
	/** The occurrence's nominal date when it was postponed to this day. */
	rescheduledFrom: CalendarDate | null;
	/** Its live postponements (0 when not postponed). */
	count: number;
}

/**
 * "Adiar" on a habit row: only on today and the preview days, on the row
 * whose occurrence lives that day (not overdue, not done, the habit a single
 * date or days of the month and not archived); disabled with the reason when
 * the limit is reached or no date is left before the next occurrence.
 */
export function rescheduleAvailability(
	habit: Pick<SchedulableHabit, "schedule" | "start_date" | "archived_at">,
	row: RescheduleRowContext
): RescheduleAvailability {
	if (!isReschedulableSchedule(habit.schedule)) return { state: "hidden" };
	if (habit.archived_at !== null) return { state: "hidden" };
	if (row.date < row.today || row.overdue || row.done)
		return { state: "hidden" };
	if (row.count >= MAX_RESCHEDULES) {
		return { state: "disabled", reason: LIMIT_REACHED_TEXT };
	}
	const original = row.rescheduledFrom ?? row.date;
	const bounds = rescheduleBounds(
		habit,
		{ original, effective: row.date },
		row.today
	);
	if (bounds === null) {
		return {
			state: "disabled",
			reason: "Sem data possível antes da próxima ocorrência",
		};
	}
	return { state: "enabled" };
}

export interface RescheduleShortcut {
	label: string;
	date: CalendarDate;
	/** Why it cannot be picked, or null. */
	disabledReason: string | null;
}

/**
 * The dialog's quick choices: from today, "Amanhã" and "Daqui a 1 semana";
 * from a later effective date (a preview day), "Dia seguinte" and "Uma
 * semana depois". Each is disabled with its reason outside the bounds.
 */
export function rescheduleShortcuts(
	effective: CalendarDate,
	today: CalendarDate,
	bounds: RescheduleBounds
): RescheduleShortcut[] {
	const fromToday = effective <= today;
	const base = fromToday ? today : effective;
	const choices = fromToday
		? [
				{ label: "Amanhã", date: addDays(base, 1) },
				{ label: "Daqui a 1 semana", date: addDays(base, 7) },
			]
		: [
				{ label: "Dia seguinte", date: addDays(base, 1) },
				{ label: "Uma semana depois", date: addDays(base, 7) },
			];
	return choices.map((choice) => ({
		...choice,
		disabledReason:
			choice.date < bounds.min
				? `Precisa ser depois de ${formatDayMonth(addDays(bounds.min, -1), today)}`
				: choice.date > bounds.max
					? bounds.limit === "next" && bounds.next !== null
						? `Passa da próxima ocorrência (${formatDayMonth(bounds.next, today)})`
						: `Mais de ${RESCHEDULE_MAX_DAYS} dias à frente`
					: null,
	}));
}

/**
 * The effect shown before confirming: "O dia 20/10 deixa de contar este
 * hábito (sem falha). Passa para 27/10." and how many postponements remain.
 */
export function rescheduleSummary({
	effective,
	to,
	count,
	today,
}: {
	effective: CalendarDate;
	to: CalendarDate;
	/** Live postponements before this one. */
	count: number;
	today: CalendarDate;
}): { effect: string; remaining: string; last: boolean } {
	const left = MAX_RESCHEDULES - (count + 1);
	return {
		effect: `O dia ${formatDayMonth(effective, today)} deixa de contar este hábito (sem falha). Passa para ${formatDayMonth(to, today)}.`,
		remaining:
			left <= 0
				? "Este é o último adiamento desta ocorrência."
				: `${left === 1 ? "Resta" : "Restam"} ${left} ${left === 1 ? "adiamento" : "adiamentos"}.`,
		last: left <= 0,
	};
}

export interface DateLabel {
	text: string;
	/** For screen readers. */
	spoken: string;
}

function spokenDate(date: CalendarDate, today: CalendarDate): string {
	const { year, month, day } = parseCalendarDate(date);
	const sameYear = parseCalendarDate(today).year === year;
	return `${day} de ${MONTH_NAMES[month - 1]}${sameYear ? "" : ` de ${year}`}`;
}

/** The badge of a postponed occurrence on its new day: "Adiado de 20/10". */
export function rescheduledLabel(
	original: CalendarDate,
	today: CalendarDate
): DateLabel {
	return {
		text: `Adiado de ${formatDayMonth(original, today)}`,
		spoken: `adiado de ${spokenDate(original, today)}`,
	};
}

/** The note on its nominal day: "Adiado para 27/10". */
export function movedOutLabel(
	to: CalendarDate,
	today: CalendarDate
): DateLabel {
	return {
		text: `Adiado para ${formatDayMonth(to, today)}`,
		spoken: `adiado para ${spokenDate(to, today)}`,
	};
}

/** The toast after postponing. */
export function rescheduledToast(
	to: CalendarDate,
	today: CalendarDate
): string {
	return `Adiado para ${formatDayMonth(to, today)}`;
}

export const RESCHEDULE_UNDONE_TOAST = "Adiamento desfeito";

/**
 * The postponements an edit of the habit would turn into orphans (ignored,
 * not deleted): those valid now and not under the new schedule.
 */
export function orphanedReschedules(
	habit: Pick<SchedulableHabit, "id" | "schedule" | "start_date">,
	next: { schedule: StoredSchedule; start_date: CalendarDate },
	index: RescheduleIndex
): OccurrenceMove[] {
	return movesOf(habit, index).filter((move) => !isMoveValid(next, move));
}

/** The edit form's notice for `orphanedReschedules`, or null. */
export function orphanNotice(
	moves: readonly Pick<OccurrenceMove, "original" | "effective">[],
	next: { schedule: StoredSchedule; start_date: CalendarDate },
	today: CalendarDate
): string | null {
	if (moves.length === 0) return null;
	const dates = moves
		.map((move) => formatDayMonth(move.effective, today))
		.join(", ");
	const back = moves.some(
		(move) =>
			isReschedulableSchedule(next.schedule) &&
			move.original >= next.start_date &&
			matchesSchedule(next.schedule, move.original)
	);
	const head =
		moves.length === 1
			? `1 adiamento deixa de valer: ${dates} deixa de ter esta ocorrência.`
			: `${moves.length} adiamentos deixam de valer: ${dates} deixam de ter estas ocorrências.`;
	return back
		? `${head} A ocorrência volta para o dia original e pode contar como falha lá.`
		: head;
}
