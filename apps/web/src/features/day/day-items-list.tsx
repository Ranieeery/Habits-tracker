import type { CalendarDate, Habit } from "@habits/contracts";
import {
	type DayItem,
	deadlineDoneLabel,
	deadlineLabel,
	overdueLabel,
} from "@habits/core";
import { CalendarRange } from "lucide-react";
import { useId } from "react";
import { DayHabitItem } from "./day-habit-item.tsx";

/**
 * A day's rows (`useDayItems`): overdue habits first with their badge, then
 * the day's habits, then (today, 2.13.0) the open deadline tasks under "Com
 * prazo", by due date. Shared by the day view and the heatmap's "Hoje" panel.
 */
export function DayItemsList({
	date,
	items,
	editable,
	onToggle,
}: {
	date: CalendarDate;
	items: readonly DayItem[];
	editable: boolean;
	onToggle: (habit: Pick<Habit, "id" | "name">, completed: boolean) => void;
}) {
	const headingId = useId();
	const row = (item: DayItem) => (
		<DayHabitItem
			key={item.habit.id}
			habit={item.habit}
			completed={item.done}
			editable={editable}
			overdue={
				item.overdueSince === null
					? null
					: overdueLabel(item.overdueSince, date)
			}
			due={item.dueDate === null ? null : deadlineLabel(item.dueDate, date)}
			doneOn={
				item.completedOn === null
					? null
					: deadlineDoneLabel(item.completedOn, date)
			}
			onToggle={(completed) => onToggle(item.habit, completed)}
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
		</div>
	);
}
