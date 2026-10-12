import type { OverviewStats } from "@habits/core";
import { Text, View } from "react-native";
import { DisplayText } from "@/ui/display-text.tsx";
import { overviewItems } from "./overview-format.ts";
import { SkeletonBlock } from "./heatmap-states.tsx";

/**
 * The four numbers above the heatmap (core's `overviewStats`, as on the
 * web): current and best runs of strong days (80% or more) and this week's
 * and this month's share. Two columns, so the numbers stay large on a phone
 * and wrap instead of shrinking with a big system font. `stats` is null
 * while loading.
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
				className="flex-row flex-wrap gap-y-4"
			>
				{[0, 1, 2, 3].map((i) => (
					<View key={i} className="w-1/2 gap-2 pr-4">
						<SkeletonBlock className="h-4 w-24 rounded-sm" />
						<SkeletonBlock className="h-8 w-16 rounded-sm" />
					</View>
				))}
			</View>
		);
	}

	return (
		<View className="gap-3">
			<View accessibilityRole="summary" className="flex-row flex-wrap gap-y-4">
				{overviewItems(stats, year).map((item) => (
					<View
						key={item.label}
						accessible
						accessibilityLabel={item.accessibilityLabel}
						className="w-1/2 gap-0.5 pr-4"
					>
						<Text className="text-sm text-night-muted">{item.label}</Text>
						<View className="flex-row items-baseline gap-1">
							<DisplayText
								className="text-3xl text-night-foreground"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{item.value}
							</DisplayText>
							{item.unit ? (
								<Text className="text-sm font-medium text-night-muted">
									{item.unit}
								</Text>
							) : null}
						</View>
					</View>
				))}
			</View>
			<Text className="text-xs text-night-subtle">
				Sequência: dias seguidos com 80% ou mais dos hábitos feitos.
			</Text>
		</View>
	);
}
