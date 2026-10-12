import type { Habit } from "@habits/contracts";
import { moveHabit, type SortKeyChange, withSortKeys } from "@habits/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import { invalidateHabitData, queryKeys, updateHabit } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";

/**
 * Moves a habit in the user's order (core `moveHabit`: normally one PATCH
 * with a key between the new neighbors). The habits list is reordered
 * synchronously, before the request, so a drop never shows the old order for
 * a frame; a failure puts the previous list back and says so.
 */
export function useReorderHabit() {
	const { api } = useServices();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationKey: ["habit", "reorder"],
		mutationFn: ({
			changes,
		}: {
			changes: SortKeyChange[];
			previous?: Habit[];
		}) =>
			Promise.all(
				changes.map((change) =>
					updateHabit(api, change.habit_id, { sort_key: change.sort_key })
				)
			),
		onMutate: async ({ changes }) => {
			// Cancelling a refetch in flight reverts its data asynchronously:
			// apply the new order again once it is done.
			await queryClient.cancelQueries({ queryKey: queryKeys.habits });
			const current = queryClient.getQueryData<Habit[]>(queryKeys.habits);
			if (current) {
				queryClient.setQueryData(
					queryKeys.habits,
					withSortKeys(current, changes)
				);
			}
		},
		onError: (error, { previous }) => {
			if (previous) queryClient.setQueryData(queryKeys.habits, previous);
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível mover o hábito", {
					description: errorMessage(error),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	/** Moves `habitId` to `toIndex` within `ordered` (the list as shown). */
	const move = (
		ordered: readonly Pick<Habit, "id" | "sort_key">[],
		habitId: string,
		toIndex: number
	) => {
		const changes = moveHabit(ordered, habitId, toIndex);
		if (changes.length === 0) return;
		const previous = queryClient.getQueryData<Habit[]>(queryKeys.habits);
		if (previous) {
			queryClient.setQueryData(
				queryKeys.habits,
				withSortKeys(previous, changes)
			);
		}
		mutation.mutate({ changes, previous });
	};

	return { move, isPending: mutation.isPending };
}
