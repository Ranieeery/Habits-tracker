import type { CalendarDate } from "@habits/contracts";
import { dayItems } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { dayQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToggleCompletion } from "./use-toggle-completion.ts";

/**
 * The rows of a day and their toggle. On today these are "today's items"
 * (2.8.0): the overdue fixed-day habits first (the API's `overdue`), then
 * the day's habits, with the progress from core's `dayItems` (a pending
 * overdue habit is not counted). Shared by the day view and the heatmap's
 * "Hoje" panel. Marking an overdue habit writes today's completion, like any
 * other; the optimistic update only touches `completed_habit_ids`, which
 * `dayItems` reads.
 */
export function useDayItems(date: CalendarDate) {
	const { api } = useServices();
	const day = useQuery(dayQuery(api, date));
	const toggle = useToggleCompletion(date);
	const view = useMemo(
		() => (day.data ? dayItems(day.data) : null),
		[day.data]
	);
	return { day, view, toggle };
}
