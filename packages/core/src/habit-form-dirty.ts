// Unsaved changes in the habit form (2.16.2): whether closing it should ask
// "Descartar alterações?" first. The form keeps the state it opened with
// (defaults when creating, the saved habit when editing) and compares it with
// what is on screen now, both normalized, so typing only spaces, putting a
// value back or switching the repetition and back is not a change. Shared by
// the web dialogs and the mobile sheets and screens.
import type { HabitDraft } from "./habit-draft.ts";

/** What the habit form holds: `draft` is null for a schedule it cannot edit. */
export interface HabitFormState {
	name: string;
	description?: string | null;
	draft: HabitDraft | null;
}

/** The form's values as compared: only the fields of the chosen repetition. */
export interface NormalizedHabitForm {
	name: string;
	description: string;
	/** Absent for a schedule the form cannot edit (name and description only). */
	schedule?: readonly (string | number)[];
}

const text = (value: string | null | undefined): string =>
	(value ?? "").replace(/\r\n?/g, "\n").trim();

const days = (values: readonly number[]): number[] =>
	[...new Set(values)].sort((a, b) => a - b);

/** "02" and "2" are the same interval; anything else stays as typed. */
const every = (value: string): string => {
	const trimmed = value.trim();
	return /^\d+$/.test(trimmed) ? String(Number(trimmed)) : trimmed;
};

function scheduleFields(draft: HabitDraft): (string | number)[] {
	const start = draft.start || "";
	switch (draft.kind) {
		case "weekdays":
			return [draft.kind, start, ...days(draft.weekdays)];
		case "interval":
			return [draft.kind, start, every(draft.every)];
		case "monthly_days":
			return [draft.kind, start, ...days(draft.monthDays)];
		case "once":
			return [draft.kind, draft.date || ""];
		case "yearly":
			return [draft.kind, start, draft.month, draft.day];
		case "deadline":
			return [draft.kind, draft.due || ""];
		default: {
			const unknown: never = draft.kind;
			throw new Error(`Unknown repetition: ${String(unknown)}`);
		}
	}
}

/**
 * Normalizes the form: name and description trimmed (line breaks at the
 * ends too; empty, null and undefined are the same), days of the week and of
 * the month sorted without duplicates, and only the fields the chosen
 * repetition uses (with its "Começa em" where the form has one).
 */
export function normalizeHabitForm(state: HabitFormState): NormalizedHabitForm {
	const normalized: NormalizedHabitForm = {
		name: text(state.name),
		description: text(state.description),
	};
	if (state.draft) normalized.schedule = scheduleFields(state.draft);
	return normalized;
}

/** Whether the form on screen differs from the one it opened with. */
export function isHabitFormDirty(
	initial: NormalizedHabitForm,
	current: HabitFormState
): boolean {
	const now = normalizeHabitForm(current);
	if (now.name !== initial.name || now.description !== initial.description) {
		return true;
	}
	const a = initial.schedule;
	const b = now.schedule;
	if (a === undefined || b === undefined) return a !== b;
	return a.length !== b.length || a.some((value, index) => value !== b[index]);
}

/**
 * What a request to close the form does (Esc, a click outside, "Fechar",
 * Android back): close at once without changes, ask with changes, and keep
 * editing when the question is already open (a second Esc or back only
 * closes the question). Closings from the flow itself (saved, archived)
 * never come through here.
 */
export function resolveCloseRequest({
	dirty,
	asking,
}: {
	dirty: boolean;
	asking: boolean;
}): "close" | "ask" | "keep" {
	if (asking) return "keep";
	return dirty ? "ask" : "close";
}

/** The question's texts, the same on web and mobile. */
export const DISCARD_CHANGES = {
	title: "Descartar alterações?",
	body: "Você tem alterações que não foram salvas.",
	keep: "Continuar editando",
	discard: "Descartar",
} as const;
