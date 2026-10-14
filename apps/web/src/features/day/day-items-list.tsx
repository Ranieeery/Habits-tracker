import type { CalendarDate, Habit } from "@habits/contracts";
import type { DayItem } from "@habits/core";
import { CalendarRange } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { EditHabitDialog } from "@/features/habits/edit-habit-dialog.tsx";
import { DayHabitItem } from "./day-habit-item.tsx";
import { useHabitActions } from "./use-habit-actions.ts";

/**
 * A day's rows (`useDayItems`): overdue habits first with their badge, then
 * the day's habits, then (today, 2.13.0) the open deadline tasks under "Com
 * prazo", by due date. Shared by the day view and the heatmap's "Hoje" panel.
 * 2.15.0: with `actions` (only the Hoje tab, `/today`), every row has the
 * habit's actions menu, with one edit dialog for the whole list.
 */
export function DayItemsList({
	date,
	items,
	editable,
	actions = false,
	onToggle,
}: {
	date: CalendarDate;
	items: readonly DayItem[];
	editable: boolean;
	actions?: boolean;
	onToggle: (habit: Pick<Habit, "id" | "name">, completed: boolean) => void;
}) {
	const headingId = useId();
	const menu = useHabitActions();
	// The rows are memoized: hand them a toggle that never changes and calls
	// the latest one the parent gave.
	const latestToggle = useRef(onToggle);
	useEffect(() => {
		latestToggle.current = onToggle;
	});
	const toggle = useCallback(
		(habit: Habit, completed: boolean) =>
			latestToggle.current(habit, completed),
		[]
	);
	const row = (item: DayItem) => (
		<DayHabitItem
			key={item.habit.id}
			item={item}
			date={date}
			editable={editable}
			onToggle={toggle}
			onAction={actions ? menu.onAction : undefined}
		/>
	);
	const dayRows = items.filter((item) => item.dueDate === null);
	const deadlineRows = items.filter((item) => item.dueDate !== null);
	return (
		<div className="flex flex-col gap-3">
			{dayRows.length > 0 && (
				<ul className="-mx-2 flex flex-col">{dayRows.map(row)}</ul>
			)}
			{deadlineRows.length > 0 && (
				<section aria-labelledby={headingId} className="flex flex-col gap-1">
					<h3
						id={headingId}
						className="flex items-center gap-2 text-sm font-semibold text-night-muted"
					>
						<CalendarRange
							className="size-4 text-night-accent-text"
							aria-hidden="true"
						/>
						Com prazo
					</h3>
					<ul className="-mx-2 flex flex-col">{deadlineRows.map(row)}</ul>
				</section>
			)}
			{actions && menu.editing && (
				<EditHabitDialog
					habit={menu.editing}
					open={menu.open}
					onOpenChange={menu.setOpen}
				/>
			)}
		</div>
	);
}
