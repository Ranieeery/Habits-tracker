import type { CalendarDate, Habit } from "@habits/contracts";
import { type DayItem, overdueLabel } from "@habits/core";
import { DayHabitItem } from "./day-habit-item.tsx";

/**
 * A day's rows (`useDayItems`): overdue habits first with their badge, then
 * the day's habits. Shared by the day view and the heatmap's "Hoje" panel.
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
	return (
		<ul className="-mx-2 flex flex-col">
			{items.map((item) => (
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
					onToggle={(completed) => onToggle(item.habit, completed)}
				/>
			))}
		</ul>
	);
}
