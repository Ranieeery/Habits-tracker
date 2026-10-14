// The postponed occurrences of fixed-day habits (2.16.0) in the shape the
// schedule rules read them: built once per view from the live
// `habit_reschedules` rows and the completions, and passed to every function
// that decides whether a habit is possible on a date (`ScheduleOptions`).
// Pure: no clock, no I/O.
import {
	type CalendarDate,
	type Completion,
	type HabitReschedule,
	isSupportedSchedule,
	type StoredSchedule,
} from "@habits/contracts";
import { addDays } from "./dates.ts";
import { matchesSchedule } from "./schedule-match.ts";

export type RescheduleFacts = Pick<
	HabitReschedule,
	| "id"
	| "habit_id"
	| "original_date"
	| "from_date"
	| "to_date"
	| "sequence"
	| "deleted_at"
>;

type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

/** One postponed occurrence: where it nominally was and where it lives. */
export interface OccurrenceMove {
	habitId: string;
	/** O: the nominal date, from the schedule. */
	original: CalendarDate;
	/** E: the `to_date` of the live row with the highest sequence. */
	effective: CalendarDate;
	/** Live postponements of this occurrence. */
	count: number;
	/** That row, the one an undo tombstones. */
	last: RescheduleFacts;
	/**
	 * A live completion in `[O, E)`: the occurrence was fulfilled before its
	 * effective date, so E does not count (like a deadline task done before
	 * its due date).
	 */
	settledEarly: boolean;
}

interface HabitMoves {
	byOriginal: Map<CalendarDate, OccurrenceMove>;
	byEffective: Map<CalendarDate, OccurrenceMove>;
}

/** Read only; build it with `rescheduleIndex`. */
export interface RescheduleIndex {
	readonly byHabit: ReadonlyMap<string, HabitMoves>;
}

/**
 * No postponement at all: what a habit created now has, and what the views
 * computed before 2.16.0 equal (tests prove every result identical).
 */
export const NO_RESCHEDULES: RescheduleIndex = Object.freeze({
	byHabit: new Map<string, HabitMoves>(),
});

/**
 * Groups the live rows by occurrence (habit and nominal date). `completions`
 * are the live completions of those habits (any range that covers `[O, E)`;
 * deleted ones are ignored).
 */
export function rescheduleIndex(
	reschedules: Iterable<RescheduleFacts>,
	completions: Iterable<CompletionFacts>
): RescheduleIndex {
	const byOccurrence = new Map<string, OccurrenceMove>();
	for (const row of reschedules) {
		if (row.deleted_at !== null) continue;
		const key = `${row.habit_id}|${row.original_date}`;
		const current = byOccurrence.get(key);
		if (!current) {
			byOccurrence.set(key, {
				habitId: row.habit_id,
				original: row.original_date,
				effective: row.to_date,
				count: 1,
				last: row,
				settledEarly: false,
			});
			continue;
		}
		current.count += 1;
		if (row.sequence > current.last.sequence) {
			current.last = row;
			current.effective = row.to_date;
		}
	}
	if (byOccurrence.size === 0) return NO_RESCHEDULES;

	const byHabit = new Map<string, HabitMoves>();
	for (const move of byOccurrence.values()) {
		// A row that did not move the date (never written by the rules) is
		// not a postponement.
		if (move.effective <= move.original) continue;
		const moves = byHabit.get(move.habitId) ?? {
			byOriginal: new Map(),
			byEffective: new Map(),
		};
		moves.byOriginal.set(move.original, move);
		moves.byEffective.set(move.effective, move);
		byHabit.set(move.habitId, moves);
	}
	for (const completion of completions) {
		if (completion.deleted_at !== null) continue;
		const moves = byHabit.get(completion.habit_id);
		if (!moves) continue;
		for (const move of moves.byOriginal.values()) {
			if (completion.date >= move.original && completion.date < move.effective)
				move.settledEarly = true;
		}
	}
	return { byHabit };
}

/** Schedules whose occurrences can be postponed: single date, days of the month. */
export function isReschedulableSchedule(schedule: StoredSchedule): boolean {
	return (
		isSupportedSchedule(schedule) &&
		(schedule.type === "once" || schedule.type === "monthly_days")
	);
}

/** Every `monthly_days` schedule occurs at least once in any 31 days. */
const NEXT_NOMINAL_LOOKAHEAD = 62;

/**
 * The first nominal occurrence after `date` (schedule and start only, no
 * postponements), within two months; null for a single date or when there is
 * none (an unsupported schedule).
 */
export function nextNominalAfter(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	date: CalendarDate
): CalendarDate | null {
	if (!isSupportedSchedule(habit.schedule)) return null;
	if (habit.schedule.type === "once") return null;
	for (let offset = 1; offset <= NEXT_NOMINAL_LOOKAHEAD; offset++) {
		const candidate = addDays(date, offset);
		if (
			candidate >= habit.start_date &&
			matchesSchedule(habit.schedule, candidate)
		) {
			return candidate;
		}
	}
	return null;
}

// Per schedule object (habits are re-created on every change, so a stale
// entry is never read): `${start}|${O}|${E}` → valid.
const validity = new WeakMap<object, Map<string, boolean>>();

/**
 * Whether a postponement applies to the habit as it is now. It is an orphan
 * (ignored everywhere, never deleted) when the habit is no longer a single
 * date or days of the month, when its nominal date stopped being an
 * occurrence (the schedule or the single date was edited), or, for days of
 * the month, when its effective date reaches the next nominal occurrence.
 */
export function isMoveValid(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	move: Pick<OccurrenceMove, "original" | "effective">
): boolean {
	const { schedule } = habit;
	let cache = validity.get(schedule);
	const key = `${habit.start_date}|${move.original}|${move.effective}`;
	const cached = cache?.get(key);
	if (cached !== undefined) return cached;
	let valid =
		isReschedulableSchedule(schedule) &&
		move.original >= habit.start_date &&
		matchesSchedule(schedule, move.original);
	if (valid) {
		const next = nextNominalAfter(habit, move.original);
		if (next !== null && move.effective >= next) valid = false;
	}
	if (!cache) {
		cache = new Map();
		validity.set(schedule, cache);
	}
	cache.set(key, valid);
	return valid;
}

/** The habit's valid postponed occurrence whose nominal date is `date`. */
export function moveFrom(
	habit: {
		id: string;
		schedule: StoredSchedule;
		start_date: CalendarDate;
	},
	date: CalendarDate,
	index: RescheduleIndex
): OccurrenceMove | null {
	const move = index.byHabit.get(habit.id)?.byOriginal.get(date);
	return move && isMoveValid(habit, move) ? move : null;
}

/** The habit's valid postponed occurrence that lives on `date`. */
export function moveTo(
	habit: {
		id: string;
		schedule: StoredSchedule;
		start_date: CalendarDate;
	},
	date: CalendarDate,
	index: RescheduleIndex
): OccurrenceMove | null {
	const move = index.byHabit.get(habit.id)?.byEffective.get(date);
	return move && isMoveValid(habit, move) ? move : null;
}

/** Whether the habit has any postponement row in the index (valid or not). */
export function hasMoves(habitId: string, index: RescheduleIndex): boolean {
	return index.byHabit.has(habitId);
}

/** The habit's valid postponed occurrences. */
export function movesOf(
	habit: {
		id: string;
		schedule: StoredSchedule;
		start_date: CalendarDate;
	},
	index: RescheduleIndex
): OccurrenceMove[] {
	const moves = index.byHabit.get(habit.id);
	if (!moves) return [];
	return [...moves.byOriginal.values()].filter((move) =>
		isMoveValid(habit, move)
	);
}
