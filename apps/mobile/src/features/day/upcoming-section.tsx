import type { CalendarDate } from "@habits/contracts";
import { formatRelativeDate, UPCOMING_DAYS, upcoming } from "@habits/core";
import { Text, View } from "react-native";
import { useHabits, useScheduleOptions } from "@/data/hooks.ts";

/**
 * "Próximos" on today's screen (read-only): the coming dates of habits that
 * do not repeat by weekday, from the device's habits (core's `upcoming`), so
 * it works offline. Hidden when nothing happens in the next UPCOMING_DAYS.
 */
export function UpcomingSection({ today }: { today: CalendarDate }) {
	const habits = useHabits();
	const options = useScheduleOptions();
	if (!habits.data) return null;
	// 2.16.0: a postponed occurrence shows on its new date.
	const items = upcoming(habits.data, today, options);
	if (items.length === 0) return null;

	return (
		<View className="gap-2">
			<Text
				accessibilityRole="header"
				className="text-lg font-bold text-night-foreground"
			>
				Próximos
			</Text>
			<Text className="text-xs text-night-muted">
				Nos próximos {UPCOMING_DAYS} dias.
			</Text>
			<View className="gap-1">
				{items.map(({ date, habit }) => (
					<View
						key={`${habit.id}:${date}`}
						accessible
						accessibilityLabel={`${formatRelativeDate(date, today)}: ${habit.name}`}
						className="min-h-touch flex-row items-center gap-3 rounded-xl border border-night-border bg-night-surface px-4"
					>
						<Text className="w-24 text-sm font-semibold text-night-muted">
							{formatRelativeDate(date, today)}
						</Text>
						<Text
							numberOfLines={1}
							className="flex-1 text-base text-night-foreground"
						>
							{habit.name}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}
