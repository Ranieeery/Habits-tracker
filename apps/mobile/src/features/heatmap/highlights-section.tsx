import type { SummaryDay } from "@habits/contracts";
import { type CalendarDate, yearHighlights } from "@habits/core";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { DisplayText } from "@/ui/display-text.tsx";
import { highlightSentences } from "./insights-format.ts";

/**
 * "Destaques" (2.7.0): at most three short sentences about the shown year,
 * only those the data supports (core's `yearHighlights`, with a minimum
 * sample so one good day never "wins" a weekday or month). Nothing at all
 * when there is nothing worth saying.
 */
export function HighlightsSection({
	days,
	today,
	year,
	currentYear,
}: {
	days: readonly SummaryDay[];
	today: CalendarDate;
	year: number;
	currentYear: boolean;
}) {
	const lines = useMemo(
		() =>
			highlightSentences(yearHighlights(days, today, year), { currentYear }),
		[days, today, year, currentYear]
	);
	if (lines.length === 0) return null;
	return (
		<View className="gap-2">
			<DisplayText
				weight="semibold"
				accessibilityRole="header"
				className="text-lg text-night-foreground"
			>
				Destaques
			</DisplayText>
			{lines.map((line) => (
				<Text key={line} className="text-sm text-night-muted">
					{line}
				</Text>
			))}
		</View>
	);
}
