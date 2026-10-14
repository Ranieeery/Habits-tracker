import type { HabitActionId } from "@habits/core";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useArchiveHabit } from "@/features/habits/use-archive-habit.ts";
import type { MenuHabit } from "./habit-actions-menu.tsx";

/**
 * What the actions of a day's rows do (2.15.0), for one list: "Editar
 * hábito" opens the habits form in one dialog per list (never one per row),
 * without leaving the day; "Ver descrição completa" goes to the habit's page
 * (the quick look's own link); "Arquivar"/"Desarquivar" are immediate, with
 * "Desfazer". `onAction` is stable, so memoized rows do not re-render.
 */
export function useHabitActions() {
	const navigate = useNavigate();
	const { archive, unarchive } = useArchiveHabit();
	// The last habit stays while the dialog closes (its exit animation).
	const [editing, setEditing] = useState<MenuHabit | null>(null);
	const [open, setOpen] = useState(false);

	const onAction = useCallback(
		(habit: MenuHabit, action: HabitActionId) => {
			switch (action) {
				case "edit":
					setEditing(habit);
					setOpen(true);
					return;
				case "description":
					void navigate({
						to: "/habits/$habitId",
						params: { habitId: habit.id },
					});
					return;
				case "archive":
					archive(habit);
					return;
				case "unarchive":
					unarchive(habit);
					return;
			}
		},
		[navigate, archive, unarchive]
	);

	return { onAction, editing, open, setOpen };
}
