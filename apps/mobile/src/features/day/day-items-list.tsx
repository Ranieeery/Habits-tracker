import type { CalendarDate, Habit } from "@habits/contracts";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
	type DayItem,
	deadlineDoneLabel,
	deadlineLabel,
	descriptionFirstLine,
	hasDescription,
	overdueLabel,
} from "@habits/core";
import { useState } from "react";
import { nightColors } from "@habits/design-tokens";
import { Text, View } from "react-native";
import { DescriptionSheet } from "@/features/habits/description-sheet.tsx";
import { HabitRow } from "./habit-row.tsx";

/**
 * A day's rows (`useDayItems`) in one `night-surface` panel: overdue habits
 * first with their badge, then the day's habits, then (today, 2.13.0) the
 * open deadline tasks under "Com prazo", by due date, with their badge.
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
				<View key={item.habit.id}>
					{item.dueDate !== null && items[index - 1]?.dueDate == null ? (
						<View
							accessibilityRole="header"
							className={`flex-row items-center gap-2 px-4 pt-4 pb-1 ${index > 0 ? "border-t border-night-border" : ""}`}
						>
							<MaterialCommunityIcons
								name="calendar-end"
								size={16}
								color={nightColors.accent.text}
							/>
							<Text className="text-sm font-semibold text-night-muted">
								Com prazo
							</Text>
						</View>
					) : null}
					<HabitRow
						name={item.habit.name}
						checked={item.done}
						disabled={disabled}
						divider={
							index > 0 &&
							!(item.dueDate !== null && items[index - 1]?.dueDate == null)
						}
						overdue={
							item.overdueSince === null
								? null
								: overdueLabel(item.overdueSince, date)
						}
						due={
							item.dueDate === null ? null : deadlineLabel(item.dueDate, date)
						}
						doneOn={
							item.completedOn === null
								? null
								: deadlineDoneLabel(item.completedOn, date)
						}
						descriptionLine={descriptionFirstLine(item.habit.description)}
						onShowDescription={
							hasDescription(item.habit)
								? () => setDescribed(item.habit)
								: undefined
						}
						onToggle={(checked) => onToggle(item.habit, checked)}
					/>
				</View>
			))}
		</View>
	);
}
