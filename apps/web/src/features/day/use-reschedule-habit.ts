import type {
	CalendarDate,
	DayResponse,
	Habit,
	HabitReschedule,
	ReschedulesResponse,
} from "@habits/contracts";
import {
	RESCHEDULE_UNDONE_TOAST,
	rescheduledToast,
	rescheduleProblemText,
} from "@habits/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { ApiClientError } from "@habits/api-client";
import { errorMessage } from "@/lib/errors.ts";
import {
	createReschedule,
	invalidateHabitData,
	queryKeys,
	undoReschedule,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";

const UNDO_MS = 6000;

/** The occurrence a row shows: its nominal and effective dates and count. */
export interface OccurrenceTarget {
	original: CalendarDate;
	effective: CalendarDate;
	count: number;
}

export interface RescheduleInput {
	habit: Habit;
	occurrence: OccurrenceTarget;
	to: CalendarDate;
}

/** The pt-BR reason of a refused postponement (`details.reason`). */
export function rescheduleFailure(error: unknown, today: CalendarDate): string {
	if (error instanceof ApiClientError) {
		const details = error.details as
			{ reason?: string; latest?: CalendarDate } | undefined;
		if (details?.reason) {
			return rescheduleProblemText(details.reason, today, details.latest);
		}
	}
	return errorMessage(error);
}

function withRow(
	data: ReschedulesResponse | undefined,
	row: HabitReschedule
): ReschedulesResponse | undefined {
	return data && { ...data, reschedules: [...data.reschedules, row] };
}

function withoutRow(
	data: ReschedulesResponse | undefined,
	rowId: string
): ReschedulesResponse | undefined {
	return (
		data && {
			...data,
			reschedules: data.reschedules.filter((row) => row.id !== rowId),
		}
	);
}

/**
 * Postponing one occurrence from a day's menu (2.16.0). Optimistic: the row
 * joins the cached postponements (the preview days and cards follow them)
 * and the habit leaves the day it was on, at once; the server's views come
 * back with `invalidateHabitData`. A toast "Adiado para 27/10" offers
 * "Desfazer" for 6 s (the last postponement's tombstone). A failure puts the
 * caches back and rejects, so the dialog stays open with the choice.
 */
export function useRescheduleHabit() {
	const { api, now, newId } = useServices();
	const queryClient = useQueryClient();
	const today = useToday();

	const undo = useMutation({
		mutationFn: ({ habit, row }: { habit: Habit; row: HabitReschedule }) =>
			undoReschedule(api, habit.id, row.id),
		onMutate: async ({ row }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.reschedules });
			const previous = queryClient.getQueryData<ReschedulesResponse>(
				queryKeys.reschedules
			);
			queryClient.setQueryData<ReschedulesResponse>(
				queryKeys.reschedules,
				(data) => withoutRow(data, row.id)
			);
			return { previous };
		},
		onSuccess: () => toast.success(RESCHEDULE_UNDONE_TOAST),
		onError: (error, _input, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.reschedules, context.previous);
			}
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível desfazer o adiamento", {
					description: rescheduleFailure(error, today),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	const create = useMutation({
		mutationFn: ({ habit, row }: { habit: Habit; row: HabitReschedule }) =>
			createReschedule(api, habit.id, {
				id: row.id,
				original_date: row.original_date,
				from_date: row.from_date,
				to_date: row.to_date,
				sequence: row.sequence,
			}),
		onMutate: async ({ habit, row }) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: queryKeys.reschedules }),
				queryClient.cancelQueries({ queryKey: queryKeys.days }),
			]);
			const previous = {
				reschedules: queryClient.getQueryData<ReschedulesResponse>(
					queryKeys.reschedules
				),
				day: queryClient.getQueryData<DayResponse>(
					queryKeys.day(row.from_date)
				),
			};
			queryClient.setQueryData<ReschedulesResponse>(
				queryKeys.reschedules,
				(data) => withRow(data, row)
			);
			queryClient.setQueryData<DayResponse>(
				queryKeys.day(row.from_date),
				(day) =>
					day && {
						...day,
						possible_habits: day.possible_habits.filter(
							(item) => item.id !== habit.id
						),
						moved_out: [
							...(day.moved_out ?? []),
							{ habit, to_date: row.to_date },
						],
					}
			);
			return previous;
		},
		onSuccess: (_saved, { habit, row }) => {
			toast(rescheduledToast(row.to_date, today), {
				description: habit.name,
				duration: UNDO_MS,
				action: {
					label: "Desfazer",
					onClick: () => undo.mutate({ habit, row }),
				},
			});
		},
		onError: (_error, { row }, previous) => {
			if (!previous) return;
			queryClient.setQueryData(queryKeys.reschedules, previous.reschedules);
			queryClient.setQueryData(queryKeys.day(row.from_date), previous.day);
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	const { mutateAsync } = create;
	const reschedule = useCallback(
		({ habit, occurrence, to }: RescheduleInput) =>
			mutateAsync({
				habit,
				row: {
					id: newId(),
					habit_id: habit.id,
					original_date: occurrence.original,
					from_date: occurrence.effective,
					to_date: to,
					sequence: occurrence.count + 1,
					created_at: now(),
					updated_at: now(),
					deleted_at: null,
				},
			}),
		[mutateAsync, now, newId]
	);
	return { reschedule, pending: create.isPending };
}
