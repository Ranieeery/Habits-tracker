// The habit actions menu (2.15.0): what a habit listed on a day offers,
// in one declarative list shared by the web menu and the mobile sheet.
// Labels and order live only here; each app maps an action id to its icon
// and handler, so a new action is one entry plus one handler.
import type { Habit } from "@habits/contracts";
import { hasDescription } from "./description.ts";
import type { RescheduleAvailability } from "./reschedule.ts";

export type HabitActionId =
	"edit" | "reschedule" | "description" | "archive" | "unarchive";

export interface HabitAction {
	id: HabitActionId;
	label: string;
	/** A short note under the label. */
	hint?: string;
	/** A careful action (styled as a warning, never as an error). */
	careful?: boolean;
	/**
	 * Shown but not available, with the reason (2.16.0: "Adiar" at its
	 * limit), instead of hiding an item the user expects there.
	 */
	disabledReason?: string;
}

/** Every action, in menu order. */
export const HABIT_ACTIONS: readonly HabitAction[] = [
	{ id: "edit", label: "Editar hábito", hint: "Vale para todos os dias" },
	{ id: "reschedule", label: "Adiar", hint: "Só esta ocorrência" },
	{ id: "description", label: "Ver descrição completa" },
	{ id: "archive", label: "Arquivar", careful: true },
	{ id: "unarchive", label: "Desarquivar" },
];

/**
 * The actions a habit offers: "Ver descrição completa" only with a
 * description, and "Arquivar" or "Desarquivar" depending on `archived_at`.
 * 2.16.0: "Adiar" as `reschedule` says (`rescheduleAvailability` for the
 * row; absent = hidden), disabled with its reason at the limit. The preview
 * days leave archiving out (`archive: false`): that stays on today.
 */
export function habitActions(
	habit: Pick<Habit, "archived_at"> & { description?: string },
	reschedule: RescheduleAvailability = { state: "hidden" },
	{ archive = true }: { archive?: boolean } = {}
): HabitAction[] {
	const archived = habit.archived_at !== null;
	return HABIT_ACTIONS.flatMap((action): HabitAction[] => {
		if (!archive && (action.id === "archive" || action.id === "unarchive")) {
			return [];
		}
		if (action.id === "reschedule") {
			if (reschedule.state === "hidden") return [];
			return reschedule.state === "disabled"
				? [{ ...action, disabledReason: reschedule.reason }]
				: [action];
		}
		return isShown(action.id, habit, archived) ? [action] : [];
	});
}

function isShown(
	id: HabitActionId,
	habit: { description?: string },
	archived: boolean
): boolean {
	switch (id) {
		case "description":
			return hasDescription(habit);
		case "archive":
			return !archived;
		case "unarchive":
			return archived;
		default:
			return true;
	}
}

/** The "more options" button's accessible name. */
export function habitMenuLabel(name: string): string {
	return `Mais opções de ${name}`;
}

/**
 * Archiving keeps today and every past day as they are (a habit archived
 * during D still counts on D: `isHabitPossibleOn`) and removes it from the
 * next days, the overdue list and "Com prazo".
 */
export const ARCHIVE_NOTICE =
	"Sai dos próximos dias. Hoje e o histórico continuam no mapa.";

export const ARCHIVED_TOAST = "Hábito arquivado";
export const UNARCHIVED_TOAST = "Hábito desarquivado";
/** The badge of an archived habit still listed on today or a past day. */
export const ARCHIVED_BADGE = "Arquivado";
