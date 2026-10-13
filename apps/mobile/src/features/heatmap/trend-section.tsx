import type { SummaryDay } from "@habits/contracts";
import { type CalendarDate, trendChange, weeklyTrend } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { formatPercent } from "@/lib/format.ts";
import { DisplayText } from "@/ui/display-text.tsx";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";
import { trendSentence } from "./insights-format.ts";

const WEEKS = 12;
const HEIGHT = 48;

/**
 * "Tendência" (2.7.0): twelve thin bars, one per week (Sunday to Saturday),
 * and one sentence comparing the last 4 weeks with the 4 before. Quiet on
 * purpose: no axis or grid, only the current week labelled, so the heatmap
 * stays the brightest thing on the screen. The bars grow once on mount.
 */
export function TrendSection({
	days,
	today,
}: {
	days: readonly SummaryDay[];
	today: CalendarDate;
}) {
	const trend = useMemo(() => weeklyTrend(days, today, WEEKS), [days, today]);
	const sentence = trendSentence(trendChange(trend));
	const reduced = useReducedMotion();
	const grow = useSharedValue(reduced ? 1 : 0);
	useEffect(() => {
		if (reduced) {
			grow.set(1);
			return;
		}
		grow.set(
			withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
		);
	}, [reduced, grow]);
	const growStyle = useAnimatedStyle(() => ({
		transform: [{ scaleY: grow.get() }],
	}));

	if (!sentence) return null;
	const current = trend.at(-1);

	return (
		<View
			accessible
			accessibilityLabel={`Tendência. ${sentence}`}
			className="gap-3"
		>
			<DisplayText weight="semibold" className="text-lg text-night-foreground">
				Tendência
			</DisplayText>
			<View style={styles.bars} importantForAccessibility="no-hide-descendants">
				{trend.map((week) => (
					<View key={week.start} style={styles.slot}>
						<Animated.View
							style={[
								styles.bar,
								growStyle,
								{
									height:
										week.possible === 0
											? 2
											: Math.max(3, Math.round(week.ratio * HEIGHT)),
									backgroundColor:
										week.possible === 0
											? nightColors.border.strong
											: week.current
												? nightColors.accent.text
												: nightColors.heat[3],
								},
							]}
						/>
					</View>
				))}
			</View>
			<View className="flex-row items-baseline justify-between gap-3">
				<Text className="flex-1 text-sm text-night-muted">{sentence}</Text>
				{current && current.possible > 0 ? (
					<Text className="text-xs text-night-subtle">
						Esta semana {formatPercent(current.ratio)}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	bars: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 4,
		height: HEIGHT,
	},
	slot: { flex: 1, height: HEIGHT, justifyContent: "flex-end" },
	bar: { borderRadius: 2, transformOrigin: "bottom" },
});
