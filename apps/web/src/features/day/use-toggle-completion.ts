import type { CalendarDate, DayResponse } from "@habits/contracts";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import { queryKeys, setCompletion } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";

export interface ToggleVariables {
	habitId: string;
	completed: boolean;
}

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
 */
export function useToggleCompletion(date: CalendarDate) {
	const { api } = useServices();
	const key = queryKeys.day(date);

	return useMutation({
		mutationKey: ["completion", date],
		mutationFn: ({ habitId, completed }: ToggleVariables) =>
			setCompletion(api, habitId, date, completed),
		onMutate: async (variables, { client }) => {
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
				client.invalidateQueries({ queryKey: key }),
				client.invalidateQueries({ queryKey: queryKeys.summaries }),
			]),
	});
}
