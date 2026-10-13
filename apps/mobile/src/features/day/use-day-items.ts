import type { CalendarDate } from "@habits/contracts";
import { dayItems } from "@habits/core";
import { useMemo } from "react";
import { useDay } from "@/data/hooks.ts";
import { useCompletionChange } from "./use-completion-change.ts";

/**
 * The rows of a day and their toggle. On today these are "today's items"
 * (2.8.0): the overdue fixed-day habits first (computed locally by the
 * repository, offline too), then the day's habits, with the progress from
 * core's `dayItems` (a pending overdue habit is not counted). Marking an
 * overdue habit writes today's completion through the outbox, like any other,
 * with the same haptic and "Desfazer". Used by the day screen and the Hoje
 * tab, and meant for the today list on other screens.
 */
export function useDayItems(date: CalendarDate) {
	const day = useDay(date);
	const { change, dismissUndo } = useCompletionChange(date);
	const view = useMemo(
		() => (day.data ? dayItems(day.data) : null),
		[day.data]
	);
	return { day, view, change, dismissUndo };
}
