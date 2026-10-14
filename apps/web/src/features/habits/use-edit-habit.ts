import type { Habit } from "@habits/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import {
	patchHabitInCaches,
	restoreHabitCaches,
	snapshotHabitCaches,
} from "@/lib/habit-cache.ts";
import { invalidateHabitData, updateHabit } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import type { HabitFormValues } from "./habit-form.tsx";

/**
 * Saves the habit form (the habit page and, since 2.15.0, a day's actions
 * menu). The new name, description and repetition show at once in the
 * habits list and every cached day; a failure puts them back and shows why
 * (the dialog stays open with what was typed). Afterwards everything
 * refetches, since a new repetition changes what each day counts.
 */
export function useEditHabit(habit: Habit, onSaved: () => void) {
	const { api } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ name, description, schedule }: HabitFormValues) =>
			updateHabit(api, habit.id, {
				name,
				description,
				...(schedule && { schedule }),
			}),
		onMutate: async ({ name, description, schedule }) => {
			const snapshot = await snapshotHabitCaches(queryClient);
			patchHabitInCaches(queryClient, habit.id, (cached) => ({
				...cached,
				name,
				description,
				...(schedule && { schedule }),
			}));
			return snapshot;
		},
		onSuccess: () => {
			toast.success("Hábito atualizado");
			onSaved();
		},
		onError: (error, _values, snapshot) => {
			if (snapshot) restoreHabitCaches(queryClient, snapshot);
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar o hábito", {
					description: errorMessage(error),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});
}
