import type { CalendarDate, DayResponse } from "@habits/contracts";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import { queryKeys, setCompletion } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";

export interface ToggleVariables {
	habitId: string;
	completed: boolean;
	/** Shown in the "Desfazer" message. */
	habitName?: string;
	/** This change undoes the previous one: no new "Desfazer" for it. */
	undo?: boolean;
}

/** How long "Desfazer" stays available after a change. */
export const UNDO_DURATION_MS = 6000;

function withCompletion(
	day: DayResponse,
	{ habitId, completed }: ToggleVariables
): DayResponse {
	const others = day.completed_habit_ids.filter((id) => id !== habitId);
	return {
		...day,
		completed_habit_ids: completed ? [...others, habitId] : others,
	};
}

/**
 * Marks a habit done/undone on `date`. The day view updates at once; on
 * failure it rolls back and shows a toast. The heatmap refetches afterwards.
 * Each saved change shows a message with "Desfazer" (the inverse change) for
 * a few seconds; a new change replaces it, so only the last one can be
 * undone. `dismissUndo` (also called on unmount) removes it, so leaving the
 * day or locking it again never leaves an undo for a day that is not
 * editable any more.
 */
export function useToggleCompletion(date: CalendarDate) {
	const { api } = useServices();
	const key = queryKeys.day(date);
	const undoToast = useRef<string | number | null>(null);

	const dismissUndo = useCallback(() => {
		if (undoToast.current !== null) toast.dismiss(undoToast.current);
		undoToast.current = null;
	}, []);
	useEffect(() => dismissUndo, [dismissUndo]);

	const mutation = useMutation({
		mutationKey: ["completion", date],
		mutationFn: ({ habitId, completed }: ToggleVariables) =>
			setCompletion(api, habitId, date, completed),
		onMutate: async (variables, { client }) => {
			dismissUndo();
			// A refetch in flight would overwrite the optimistic value.
			await client.cancelQueries({ queryKey: key });
			const previous = client.getQueryData<DayResponse>(key);
			if (previous) {
				client.setQueryData<DayResponse>(
					key,
					withCompletion(previous, variables)
				);
			}
			return { previous };
		},
		onSuccess: (_data, variables) => {
			if (variables.undo) {
				undoToast.current = toast("Alteração desfeita");
				return;
			}
			const name = variables.habitName ? `: ${variables.habitName}` : "";
			undoToast.current = toast(
				`${variables.completed ? "Marcado" : "Desmarcado"}${name}`,
				{
					duration: UNDO_DURATION_MS,
					action: {
						label: "Desfazer",
						onClick: () =>
							mutation.mutate({
								...variables,
								completed: !variables.completed,
								undo: true,
							}),
					},
				}
			);
		},
		onError: (error, _variables, result, { client }) => {
			if (result?.previous) client.setQueryData(key, result.previous);
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar", {
					description: errorMessage(error),
				});
			}
		},
		onSettled: (_data, _error, _variables, _result, { client }) =>
			Promise.all([
				// Every cached day: a deadline task's completion moves its due
				// date's failure (2.13.0); and the first completions (Passados).
				client.invalidateQueries({ queryKey: queryKeys.days }),
				client.invalidateQueries({ queryKey: queryKeys.summaries }),
				client.invalidateQueries({ queryKey: queryKeys.deadlineFirsts }),
			]),
	});

	return { ...mutation, dismissUndo };
}
