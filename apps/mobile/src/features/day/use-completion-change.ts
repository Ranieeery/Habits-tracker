import type { CalendarDate, Habit } from "@habits/contracts";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useToggleCompletion } from "@/data/hooks.ts";
import { useDismissToast, useToast } from "@/ui/toast.tsx";

/**
 * Marks a habit done/undone on `date` with the app's feedback: selection
 * haptic, optimistic update (through the outbox, offline too), an error
 * toast, and "Desfazer" for 6 s after every saved change (the inverse
 * change; a new change replaces it). Shared by the day screen and the
 * heatmap's "Hoje" panel. `dismissUndo` removes the pending "Desfazer"
 * (e.g. when a past day locks); it also goes away when the caller unmounts,
 * so it never changes a day the user left.
 */
export function useCompletionChange(date: CalendarDate) {
	const toast = useToast();
	const dismissToast = useDismissToast();
	const toggle = useToggleCompletion(date, (error) => {
		if (!isUnauthorized(error)) {
			toast("error", "Não foi possível salvar", errorMessage(error));
		}
	});

	const undoToast = useRef<number | null>(null);
	const dismissUndo = useCallback(() => {
		if (undoToast.current !== null) dismissToast(undoToast.current);
		undoToast.current = null;
	}, [dismissToast]);
	useEffect(() => dismissUndo, [dismissUndo]);

	const change = (habit: Habit, completed: boolean, undo = false) => {
		void Haptics.selectionAsync();
		toggle.mutate(
			{ habitId: habit.id, completed },
			{
				onSuccess: () => {
					if (undo) {
						undoToast.current = toast("info", "Alteração desfeita");
						return;
					}
					undoToast.current = toast(
						"info",
						`${completed ? "Marcado" : "Desmarcado"}: ${habit.name}`,
						undefined,
						{
							action: {
								label: "Desfazer",
								onPress: () => change(habit, !completed, true),
							},
						}
					);
				},
			}
		);
	};

	return { change, dismissUndo };
}
