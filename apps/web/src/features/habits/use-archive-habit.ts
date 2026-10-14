import type { Habit } from "@habits/contracts";
import { ARCHIVE_NOTICE, ARCHIVED_TOAST, UNARCHIVED_TOAST } from "@habits/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import {
	archiveHabitInCaches,
	patchHabitInCaches,
	restoreHabitCaches,
	snapshotHabitCaches,
} from "@/lib/habit-cache.ts";
import { invalidateHabitData, updateHabit } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";

const UNDO_MS = 6000;

/**
 * Archiving and unarchiving from a day's actions menu (2.15.0): immediate,
 * no confirmation, since unarchiving undoes it exactly. Archiving shows the
 * change at once (today and past days keep the habit, marked "Arquivado";
 * later days, the overdue list and "Com prazo" lose it) and a toast offers
 * "Desfazer" for 6 s, which unarchives. Failures put the caches back.
 */
export function useArchiveHabit() {
	const { api, now } = useServices();
	const queryClient = useQueryClient();
	const today = useToday();

	const setArchived = useMutation({
		mutationFn: ({ habit, archived }: { habit: Habit; archived: boolean }) =>
			updateHabit(api, habit.id, { archived }),
		onMutate: async ({ habit, archived }) => {
			const snapshot = await snapshotHabitCaches(queryClient);
			if (archived) {
				archiveHabitInCaches(queryClient, habit.id, now(), today);
			} else {
				patchHabitInCaches(queryClient, habit.id, (cached) => ({
					...cached,
					archived_at: null,
				}));
			}
			return snapshot;
		},
		onSuccess: (_saved, { habit, archived }) => {
			if (archived) {
				toast(ARCHIVED_TOAST, {
					description: `${habit.name}. ${ARCHIVE_NOTICE}`,
					duration: UNDO_MS,
					action: {
						label: "Desfazer",
						onClick: () => setArchived.mutate({ habit, archived: false }),
					},
				});
			} else {
				toast.success(UNARCHIVED_TOAST, { description: habit.name });
			}
		},
		onError: (error, { archived }, snapshot) => {
			if (snapshot) restoreHabitCaches(queryClient, snapshot);
			if (!isUnauthorized(error)) {
				toast.error(
					archived
						? "Não foi possível arquivar o hábito"
						: "Não foi possível desarquivar o hábito",
					{ description: errorMessage(error) }
				);
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	// `mutate` is stable: so are these (memoized rows keep their props).
	const { mutate } = setArchived;
	const archive = useCallback(
		(habit: Habit) => mutate({ habit, archived: true }),
		[mutate]
	);
	const unarchive = useCallback(
		(habit: Habit) => mutate({ habit, archived: false }),
		[mutate]
	);
	return { archive, unarchive };
}
