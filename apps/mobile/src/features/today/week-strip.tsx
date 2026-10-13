import type { CalendarDate } from "@habits/contracts";
import { parseCalendarDate } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { useYearSummary } from "@/data/hooks.ts";
import { DisplayText } from "@/ui/display-text.tsx";
import { levelFill } from "@/features/heatmap/heatmap-layout.ts";
import { stripDays, stripNeedsPreviousYear } from "./week-strip-model.ts";

/**
 * The last seven days on the Hoje tab (2.6.0): a tap shows that day below,
 * with the usual rules (a past day opens read-only until "Editar este dia").
 * Each pill carries the day's heatmap level as a small square, so its text
 * never sits on a bright violet; the chosen one is `night-accent`, today has
 * a dot. 44 dp+ targets, read as tabs ("sábado, 10 de outubro: 3 de 5…").
 */
export function WeekStrip({
	today,
	selected,
	onSelect,
}: {
	today: CalendarDate;
	selected: CalendarDate;
	onSelect: (date: CalendarDate) => void;
}) {
	const year = parseCalendarDate(today).year;
	const current = useYearSummary(year);
	const needsPrevious = stripNeedsPreviousYear(today);
	const previous = useYearSummary(year - 1, { enabled: needsPrevious });
	const days = stripDays(today, [
		...(needsPrevious ? (previous.data ?? []) : []),
		...(current.data ?? []),
	]);

	return (
		<View accessibilityRole="tablist" className="flex-row gap-1.5">
			{days.map((day) => {
				const chosen = day.date === selected;
				return (
					<PressableScale
						key={day.date}
						accessibilityRole="tab"
						accessibilityLabel={day.label}
						accessibilityState={{ selected: chosen }}
						onPress={() => onSelect(day.date)}
						outerStyle={{ flex: 1 }}
						className={`min-h-touch items-center gap-1 rounded-lg py-2 ${chosen ? "bg-night-accent" : "bg-night-surface active:bg-night-surface-raised"}`}
					>
						<Text
							maxFontSizeMultiplier={1.3}
							className={`text-xs font-medium ${chosen ? "text-night-accent-on" : "text-night-subtle"}`}
						>
							{day.initial}
						</Text>
						<DisplayText
							maxFontSizeMultiplier={1.3}
							className={`text-lg ${chosen ? "text-night-accent-on" : "text-night-foreground"}`}
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{day.dayOfMonth}
						</DisplayText>
						<View
							style={[
								styles.level,
								{ backgroundColor: levelFill(day.level) },
								day.level === 0 && styles.empty,
							]}
						/>
						{day.isToday ? (
							<View
								style={[
									styles.dot,
									{
										backgroundColor: chosen
											? nightColors.accent.on
											: nightColors.accent.text,
									},
								]}
							/>
						) : (
							<View style={styles.dotSpace} />
						)}
					</PressableScale>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	level: { width: 12, height: 12, borderRadius: 3 },
	empty: { borderWidth: 1, borderColor: nightColors.border.strong },
	dot: { width: 4, height: 4, borderRadius: 2 },
	dotSpace: { height: 4 },
});
