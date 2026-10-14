import type { CalendarDate, Habit } from "@habits/contracts";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
	type DayItem,
	deadlineDoneLabel,
	deadlineLabel,
	descriptionFirstLine,
	hasDescription,
	overdueLabel,
	rescheduleAvailability,
	rescheduledLabel,
} from "@habits/core";
import { useState } from "react";
import { nightColors } from "@habits/design-tokens";
import { Text, View } from "react-native";
import { useToday } from "@/data/today.ts";
import { DescriptionSheet } from "@/features/habits/description-sheet.tsx";
import { useHabitActionsSheet } from "./habit-actions-sheet.tsx";
import { HabitRow } from "./habit-row.tsx";

/**
 * A day's rows (`useDayItems`) in one `night-surface` panel: overdue habits
 * first with their badge, then the day's habits, then (today, 2.13.0) the
 * open deadline tasks under "Com prazo", by due date, with their badge.
 * 2.15.0: with `actions`, every row opens the habit's actions sheet (one
 * per list): the Hoje tab and, since 2.16.1, days opened from the history.
 * 2.16.0: the sheet also offers "Adiar" on the rows whose occurrence lives
 * on the day shown (core's `rescheduleAvailability`), and a postponed one
 * carries "Adiado de 20/10".
 */
export function DayItemsList({
	date,
	items,
	disabled,
	actions = false,
	onToggle,
}: {
	date: CalendarDate;
	items: readonly DayItem[];
	disabled: boolean;
	actions?: boolean;
	onToggle: (habit: Habit, completed: boolean) => void;
}) {
	const [described, setDescribed] = useState<Habit | null>(null);
	const menu = useHabitActionsSheet();
	const today = useToday();
	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			<DescriptionSheet habit={described} onClose={() => setDescribed(null)} />
			{actions ? menu.sheet : null}
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
								: overdueLabel(
										item.overdueSince,
										date,
										item.rescheduledFrom ?? null
									)
						}
						moved={
							item.rescheduledFrom !== undefined && item.overdueSince === null
								? rescheduledLabel(item.rescheduledFrom, today)
								: null
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
						archived={item.habit.archived_at !== null}
						onShowActions={
							actions
								? (origin) =>
										menu.show(item.habit, origin, {
											availability: rescheduleAvailability(item.habit, {
												date,
												today,
												overdue: item.overdueSince !== null,
												done: item.done,
												rescheduledFrom: item.rescheduledFrom ?? null,
												count: item.rescheduleCount ?? 0,
											}),
											occurrence: {
												original: item.rescheduledFrom ?? date,
												effective: date,
												count: item.rescheduleCount ?? 0,
											},
										})
								: undefined
						}
						onToggle={(checked) => onToggle(item.habit, checked)}
					/>
				</View>
			))}
		</View>
	);
}
