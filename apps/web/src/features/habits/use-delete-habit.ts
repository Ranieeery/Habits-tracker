import type { Habit } from "@habits/contracts";
import { ApiClientError } from "@habits/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import {
	deleteHabit,
	invalidateHabitData,
	queryKeys,
	restoreHabit,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";

const UNDO_MS = 6000;

function reason(error: unknown): string {
	// 409: archived elsewhere and unarchived meanwhile.
	return error instanceof ApiClientError && error.code === "conflict"
		? "Só dá para apagar um hábito arquivado."
		: errorMessage(error);
}

/**
 * Deletes an archived habit (2.11.0). It leaves the list at once (rolled back
 * with a message on failure); a toast offers "Desfazer" for 6 s, which
 * restores it (archived, with its history). Lists, days and heatmaps refetch
 * after both, since a deleted habit leaves past days too.
 */
export function useDeleteHabit() {
	const { api } = useServices();
	const queryClient = useQueryClient();

	const restore = useMutation({
		mutationFn: (habit: Habit) => restoreHabit(api, habit.id),
		onSuccess: (habit) =>
			toast.success("Hábito restaurado", { description: habit.name }),
		onError: (error) => {
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível restaurar o hábito", {
					description: errorMessage(error),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	const remove = useMutation({
		mutationFn: (habit: Habit) => deleteHabit(api, habit.id),
		onMutate: async (habit) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.habits });
			const previous = queryClient.getQueryData<Habit[]>(queryKeys.habits);
			if (previous) {
				queryClient.setQueryData(
					queryKeys.habits,
					previous.filter((item) => item.id !== habit.id)
				);
			}
			return { previous };
		},
		onSuccess: (_deleted, habit) => {
			toast("Hábito apagado", {
				description: habit.name,
				duration: UNDO_MS,
				action: { label: "Desfazer", onClick: () => restore.mutate(habit) },
			});
		},
		onError: (error, _habit, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.habits, context.previous);
			}
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível apagar o hábito", {
					description: reason(error),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	return {
		remove: (habit: Habit) => remove.mutate(habit),
		isPending: remove.isPending || restore.isPending,
	};
}
