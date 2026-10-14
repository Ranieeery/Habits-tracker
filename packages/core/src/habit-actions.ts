// The habit actions menu (2.15.0): what a habit listed on a day offers,
// in one declarative list shared by the web menu and the mobile sheet.
// Labels and order live only here; each app maps an action id to its icon
// and handler, so a new action is one entry plus one handler.
import type { Habit } from "@habits/contracts";
import { hasDescription } from "./description.ts";

export type HabitActionId = "edit" | "description" | "archive" | "unarchive";

export interface HabitAction {
	id: HabitActionId;
	label: string;
	/** A short note under the label. */
	hint?: string;
	/** A careful action (styled as a warning, never as an error). */
	careful?: boolean;
}

/** Every action, in menu order. */
export const HABIT_ACTIONS: readonly HabitAction[] = [
	{ id: "edit", label: "Editar hábito", hint: "Vale para todos os dias" },
	{ id: "description", label: "Ver descrição completa" },
	{ id: "archive", label: "Arquivar", careful: true },
	{ id: "unarchive", label: "Desarquivar" },
];

/**
 * The actions a habit offers: "Ver descrição completa" only with a
 * description, and "Arquivar" or "Desarquivar" depending on `archived_at`.
 */
export function habitActions(
	habit: Pick<Habit, "archived_at"> & { description?: string }
): HabitAction[] {
	const archived = habit.archived_at !== null;
	return HABIT_ACTIONS.filter((action) => {
		switch (action.id) {
			case "description":
				return hasDescription(habit);
			case "archive":
				return !archived;
			case "unarchive":
				return archived;
			default:
				return true;
		}
	});
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
