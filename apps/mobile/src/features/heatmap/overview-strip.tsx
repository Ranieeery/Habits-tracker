import type { OverviewStats } from "@habits/core";
import { Text, View } from "react-native";
import { DisplayText } from "@/ui/display-text.tsx";
import { overviewItems } from "./overview-format.ts";
import { SkeletonBlock } from "./heatmap-states.tsx";

/**
 * The four numbers above the heatmap (core's `overviewStats`, as on the
 * web): current and best runs of strong days (80% or more) and this week's
 * and this month's share. One row of four, so today's panel still starts
 * in the thumb's reach; short labels, full sentences for screen readers.
 * `stats` is null while loading.
 */
export function OverviewStrip({
	stats,
	year,
}: {
	stats: OverviewStats | null;
	year: number;
}) {
	if (!stats) {
		return (
			<View
				importantForAccessibility="no-hide-descendants"
				className="flex-row"
			>
				{[0, 1, 2, 3].map((i) => (
					<View key={i} className="flex-1 gap-2 pr-2">
						<SkeletonBlock className="h-3 w-14 rounded-sm" />
						<SkeletonBlock className="h-7 w-10 rounded-sm" />
					</View>
				))}
			</View>
		);
	}

	return (
		<View accessibilityRole="summary" className="flex-row">
			{overviewItems(stats, year).map((item) => (
				<View
					key={item.label}
					accessible
					accessibilityLabel={item.accessibilityLabel}
					className="flex-1 justify-end gap-0.5 pr-2"
				>
					<Text className="text-xs text-night-muted">{item.label}</Text>
					<View className="flex-row flex-wrap items-baseline gap-x-1">
						<DisplayText
							className="text-2xl text-night-foreground"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{item.value}
						</DisplayText>
						{item.unit ? (
							<Text className="text-xs font-medium text-night-muted">
								{item.unit}
							</Text>
						) : null}
					</View>
				</View>
			))}
		</View>
	);
}
