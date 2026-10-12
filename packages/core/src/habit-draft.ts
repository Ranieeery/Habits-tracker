// The habit form shared by web and mobile: its fields, their validation (pt-BR
// messages) and the schedule they produce. Pure; the apps only render fields.
import {
	isSupportedSchedule,
	MAX_INTERVAL_DAYS,
	Schedule,
	type StoredSchedule,
} from "@habits/contracts";
import {
	type CalendarDate,
	isCalendarDate,
	parseCalendarDate,
} from "./dates.ts";
import {
	nextOccurrence,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";
import { formatRelativeDate, repeatSummary } from "./schedule-text.ts";

export type RepeatKind = Schedule["type"];

/** The repetition choices, in the order the form shows them. */
export const REPEAT_KINDS: readonly { kind: RepeatKind; label: string }[] = [
	{ kind: "weekdays", label: "Dias da semana" },
	{ kind: "interval", label: "A cada N dias" },
	{ kind: "monthly_days", label: "Dias do mês" },
	{ kind: "once", label: "Uma data" },
	{ kind: "yearly", label: "Todo ano" },
];

/** pt-BR month names, January = index 0. */
export const MONTH_NAMES = [
	"janeiro",
	"fevereiro",
	"março",
	"abril",
	"maio",
	"junho",
	"julho",
	"agosto",
	"setembro",
	"outubro",
	"novembro",
	"dezembro",
] as const;

/** Every field of the form; only those of `kind` are used. */
export interface HabitDraft {
	kind: RepeatKind;
	weekdays: number[];
	/** Text typed in the "a cada N dias" field. */
	every: string;
	monthDays: number[];
	/** Single date (`once`). */
	date: CalendarDate | "";
	month: number;
	day: number;
	/**
	 * "Começa em": the new habit's `start_date` (create), or the interval's
	 * anchor (create and edit). Not used for single dates.
	 */
	start: CalendarDate | "";
}

export type DraftField =
	"weekdays" | "every" | "monthDays" | "date" | "day" | "start";

export type DraftErrors = Partial<Record<DraftField, string>>;

/** A new habit's form: every weekday, starting today. */
export function emptyDraft(today: CalendarDate): HabitDraft {
	const { month, day } = parseCalendarDate(today);
	return {
		kind: "weekdays",
		weekdays: [0, 1, 2, 3, 4, 5, 6],
		every: "2",
		monthDays: [day],
		date: today,
		month,
		day,
		start: today,
	};
}

/**
 * The form for an existing habit. Null when its schedule is not supported by
 * this build: the repetition cannot be edited (rename/archive only).
 */
export function draftFromHabit(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	today: CalendarDate
): HabitDraft | null {
	const { schedule } = habit;
	if (!isSupportedSchedule(schedule)) return null;
	const draft = { ...emptyDraft(today), kind: schedule.type };
	draft.start = habit.start_date;
	switch (schedule.type) {
		case "weekdays":
			return { ...draft, weekdays: [...schedule.days] };
		case "interval":
			return {
				...draft,
				every: String(schedule.every),
				start: schedule.anchor_date,
			};
		case "monthly_days":
			return { ...draft, monthDays: [...schedule.days] };
		case "once":
			return { ...draft, date: schedule.date };
		case "yearly":
			return { ...draft, month: schedule.month, day: schedule.day };
		default: {
			const unknown: never = schedule;
			throw new Error(`Unknown schedule type: ${String(unknown)}`);
		}
	}
}

export interface DraftContext {
	today: CalendarDate;
	/** Editing an existing habit: its current values (dates already set stay valid). */
	editing?: { schedule: StoredSchedule; start_date: CalendarDate };
}

export type DraftResult =
	| { ok: true; schedule: Schedule; start_date: CalendarDate }
	| { ok: false; errors: DraftErrors };

const PAST_DATE = "Escolha hoje ou uma data futura.";

/**
 * Validates the form and builds the schedule and start date (the start date
 * is only sent when creating). Dates must be today or later, except a date
 * the habit already had (editing other fields never fails because of it).
 */
export function buildFromDraft(
	draft: HabitDraft,
	{ today, editing }: DraftContext
): DraftResult {
	const errors: DraftErrors = {};
	const previous =
		editing && isSupportedSchedule(editing.schedule) ? editing.schedule : null;
	const checkFuture = (
		value: CalendarDate | "",
		field: DraftField,
		unchanged: boolean
	) => {
		if (!isCalendarDate(value)) errors[field] = "Escolha uma data.";
		else if (value < today && !unchanged) errors[field] = PAST_DATE;
	};

	let candidate: unknown;
	let start: CalendarDate | "" = editing ? editing.start_date : draft.start;
	switch (draft.kind) {
		case "weekdays":
			if (draft.weekdays.length === 0) {
				errors.weekdays = "Escolha pelo menos um dia da semana.";
			}
			candidate = {
				type: "weekdays",
				days: [...new Set(draft.weekdays)].sort((a, b) => a - b),
			};
			break;
		case "interval": {
			// The anchor is the "Começa em" field (also the start when creating).
			const every = /^\d+$/.test(draft.every.trim())
				? Number(draft.every)
				: Number.NaN;
			if (!(every >= 1 && every <= MAX_INTERVAL_DAYS)) {
				errors.every = `Use um número de 1 a ${MAX_INTERVAL_DAYS}.`;
			}
			checkFuture(
				draft.start,
				"start",
				previous?.type === "interval" && previous.anchor_date === draft.start
			);
			candidate = { type: "interval", every, anchor_date: draft.start };
			break;
		}
		case "monthly_days":
			if (draft.monthDays.length === 0) {
				errors.monthDays = "Escolha pelo menos um dia do mês.";
			}
			candidate = {
				type: "monthly_days",
				days: [...new Set(draft.monthDays)].sort((a, b) => a - b),
			};
			break;
		case "once":
			checkFuture(
				draft.date,
				"date",
				previous?.type === "once" && previous.date === draft.date
			);
			if (
				!errors.date &&
				editing &&
				isCalendarDate(draft.date) &&
				draft.date < editing.start_date
			) {
				errors.date = "Escolha uma data a partir do início do hábito.";
			}
			candidate = { type: "once", date: draft.date };
			if (!editing) start = draft.date;
			break;
		case "yearly":
			candidate = { type: "yearly", month: draft.month, day: draft.day };
			break;
		default: {
			const unknown: never = draft.kind;
			throw new Error(`Unknown repeat kind: ${String(unknown)}`);
		}
	}
	// "Começa em" of a new habit: today or later (the API still accepts a
	// weekday habit up to BACKFILL_DAYS back, for offline creations).
	if (!editing && draft.kind !== "once" && draft.kind !== "interval") {
		checkFuture(draft.start, "start", false);
	}

	const parsed = Schedule.safeParse(candidate);
	if (!parsed.success && Object.keys(errors).length === 0) {
		if (draft.kind === "yearly") errors.day = "Esse dia não existe nesse mês.";
		else errors.date = "Revise a repetição.";
	}
	if (
		!parsed.success ||
		Object.keys(errors).length > 0 ||
		!isCalendarDate(start)
	) {
		return { ok: false, errors };
	}
	return { ok: true, schedule: parsed.data, start_date: start };
}

export interface DraftPreview {
	/** "Repete a cada 8 dias, a partir de 22/10". */
	summary: string;
	/** "Próxima: sex, 20/11" (null when there is none). */
	next: string | null;
}

/** What the form shows before saving, from a valid draft. */
export function previewHabit(
	habit: Pick<SchedulableHabit, "schedule" | "start_date">,
	today: CalendarDate,
	options: TimeZoneOptions
): DraftPreview {
	const next = nextOccurrence(
		{ ...habit, archived_at: null, deleted_at: null },
		today,
		options
	);
	return {
		summary: repeatSummary(habit, today),
		next: next === null ? null : `Próxima: ${formatRelativeDate(next, today)}`,
	};
}
