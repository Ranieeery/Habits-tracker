import type { CalendarDate, Habit } from "@habits/contracts";
import {
	type DayItem,
	descriptionFirstLine,
	hasDescription,
	overdueLabel,
} from "@habits/core";
import { useState } from "react";
import { View } from "react-native";
import { DescriptionSheet } from "@/features/habits/description-sheet.tsx";
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
	const [described, setDescribed] = useState<Habit | null>(null);
	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			<DescriptionSheet habit={described} onClose={() => setDescribed(null)} />
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
					descriptionLine={descriptionFirstLine(item.habit.description)}
					onShowDescription={
						hasDescription(item.habit)
							? () => setDescribed(item.habit)
							: undefined
					}
					onToggle={(checked) => onToggle(item.habit, checked)}
				/>
			))}
		</View>
	);
}
