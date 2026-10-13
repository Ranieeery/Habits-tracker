import type { Habit } from "@habits/contracts";
import {
	type CalendarDate,
	overviewStats,
	parseCalendarDate,
	recentDays,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHabitYearSummaries } from "@/data/hooks.ts";
import { formatPercent } from "@/lib/format.ts";
import { DisplayText } from "@/ui/display-text.tsx";

const VISIBLE = 5;
const STRIP_DAYS = 30;

/**
 * "Por hábito" (2.7.0): how each habit is doing, in one quiet panel. Each
 * row has the name, its month so far and current run (core's
 * `overviewStats` over that habit alone: a "strong" day is a done day) and
 * a strip of its last 30 days. A tap filters the heatmap by that habit.
 * Shows the first five and "Ver todos" for the rest.
 */
export function PerHabitSection({
	habits,
	today,
	onSelect,
}: {
	habits: readonly Habit[];
	today: CalendarDate;
	onSelect: (habitId: string) => void;
}) {
	const [showAll, setShowAll] = useState(false);
	const year = parseCalendarDate(today).year;
	const summaries = useHabitYearSummaries(
		year,
		habits.map((habit) => habit.id)
	);
	if (habits.length === 0) return null;
	const shown = showAll ? habits : habits.slice(0, VISIBLE);

	return (
		<View className="gap-3">
			<DisplayText
				weight="semibold"
				accessibilityRole="header"
				className="text-lg text-night-foreground"
			>
				Por hábito
			</DisplayText>
			<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
				{shown.map((habit, index) => {
					const days = summaries[index]?.data;
					return (
						<HabitRow
							key={habit.id}
							habit={habit}
							days={days}
							today={today}
							year={year}
							divider={index > 0}
							onPress={() => onSelect(habit.id)}
						/>
					);
				})}
				{habits.length > VISIBLE ? (
					<Pressable
						accessibilityRole="button"
						onPress={() => setShowAll((all) => !all)}
						className="min-h-touch items-center justify-center border-t border-night-border active:bg-night-surface-raised"
					>
						<Text className="text-sm font-semibold text-night-accent-text">
							{showAll ? "Mostrar menos" : `Ver todos (${habits.length})`}
						</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

function HabitRow({
	habit,
	days,
	today,
	year,
	divider,
	onPress,
}: {
	habit: Habit;
	days: Parameters<typeof recentDays>[0] | undefined;
	today: CalendarDate;
	year: number;
	divider: boolean;
	onPress: () => void;
}) {
	const stats = days ? overviewStats({ days, today, year }) : null;
	const strip = recentDays(days ?? [], today, STRIP_DAYS);
	const month =
		stats && stats.month.possible > 0 ? formatPercent(stats.month.ratio) : "—";
	const run = stats?.current_streak ?? 0;
	const runText =
		run === 0 ? null : `${run} ${run === 1 ? "dia seguido" : "dias seguidos"}`;
	const monthText = month === "—" ? "Nada previsto no mês" : `${month} no mês`;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${habit.name}: ${monthText}${runText ? `, ${runText}` : ""}`}
			accessibilityHint="Mostra o mapa só deste hábito"
			onPress={onPress}
			className={`gap-2 px-4 py-3 active:bg-night-surface-raised ${divider ? "border-t border-night-border" : ""}`}
		>
			<View className="flex-row items-baseline justify-between gap-3">
				<Text
					numberOfLines={1}
					className="flex-1 text-base text-night-foreground"
				>
					{habit.name}
				</Text>
				<Text className="text-xs text-night-muted">{monthText}</Text>
			</View>
			<View
				importantForAccessibility="no-hide-descendants"
				style={styles.strip}
			>
				{strip.map((day) => (
					<View
						key={day.date}
						style={[
							styles.cell,
							day.state === "done"
								? styles.done
								: day.state === "missed"
									? styles.missed
									: styles.none,
						]}
					/>
				))}
			</View>
			{runText ? (
				<Text className="text-xs text-night-subtle">{runText}</Text>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	strip: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 8 },
	cell: { flex: 1, height: 8, borderRadius: 2 },
	done: { backgroundColor: nightColors.heat[4] },
	missed: { backgroundColor: nightColors.heat[0] },
	// Nothing planned: only a thin baseline, so empty days stay quiet.
	none: { height: 2, backgroundColor: nightColors.border.DEFAULT },
});
