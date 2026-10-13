import type { CalendarDate, Habit } from "@habits/contracts";
import { type DayItem, overdueLabel } from "@habits/core";
import { View } from "react-native";
import { HabitRow } from "./habit-row.tsx";

/**
 * A day's rows (`useDayItems`) in one `night-surface` panel: overdue habits
 * first with their badge, then the day's habits.
 */
export function DayItemsList({
	date,
	items,
	disabled,
	onToggle,
}: {
	date: CalendarDate;
	items: readonly DayItem[];
	disabled: boolean;
	onToggle: (habit: Habit, completed: boolean) => void;
}) {
	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			{items.map((item, index) => (
				<HabitRow
					key={item.habit.id}
					name={item.habit.name}
					checked={item.done}
					disabled={disabled}
					divider={index > 0}
					overdue={
						item.overdueSince === null
							? null
							: overdueLabel(item.overdueSince, date)
					}
					onToggle={(checked) => onToggle(item.habit, checked)}
				/>
			))}
		</View>
	);
}
