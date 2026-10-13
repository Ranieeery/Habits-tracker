import type { CalendarDate, DayResponse, Schedule } from "@habits/contracts";
import { newHabit, newHabitNotice } from "@habits/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { createHabit, invalidateHabitData, queryKeys } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";

export interface NewHabitInput {
	/** Generated once per opening of the form, so a retry never duplicates. */
	id: string;
	name: string;
	/** Empty = none (2.12.0). */
	description?: string;
	schedule: Schedule;
	/** "Começa em" from the form (today by default). */
	start_date: CalendarDate;
}

/**
 * Creates a habit from today's view (it starts today unless the form says
 * later). When it counts today it joins the
 * day's list at once (unchecked) and rolls back on failure; otherwise a toast
 * says on which days it shows up. One request at a time: a second submit
 * while the first is in flight is ignored (the id makes a retry harmless too).
 */
export function useCreateHabitToday(today: CalendarDate) {
	const { api, now } = useServices();
	const timeZone = useUserTimeZone();
	const queryClient = useQueryClient();
	const inFlight = useRef(false);
	const key = queryKeys.day(today);

	const mutation = useMutation({
		mutationKey: ["habit", "create", today],
		mutationFn: (input: NewHabitInput) => createHabit(api, input),
		onMutate: async (input) => {
			// The server gives it the key after the last habit; until then an
			// empty key also sorts last.
			const habit = newHabit({ ...input, sort_key: "" }, now());
			if (newHabitNotice(habit, today, { timeZone }) !== null) {
				return { previous: undefined };
			}
			// A refetch in flight would overwrite the optimistic value.
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<DayResponse>(key);
			if (
				previous &&
				!previous.possible_habits.some((item) => item.id === habit.id)
			) {
				queryClient.setQueryData<DayResponse>(key, {
					...previous,
					possible_habits: [...previous.possible_habits, habit],
				});
			}
			return { previous };
		},
		onError: (_error, _input, context) => {
			if (context?.previous) queryClient.setQueryData(key, context.previous);
		},
		onSuccess: (habit) => {
			const notice = newHabitNotice(habit, today, { timeZone });
			if (notice) toast.success(notice);
		},
		onSettled: () => {
			inFlight.current = false;
			void invalidateHabitData(queryClient);
		},
	});

	const submit = (input: NewHabitInput, onCreated: () => void) => {
		if (inFlight.current) return;
		inFlight.current = true;
		mutation.mutate(input, { onSuccess: onCreated });
	};

	return {
		submit,
		isPending: mutation.isPending,
		error: mutation.error,
		reset: mutation.reset,
	};
}
