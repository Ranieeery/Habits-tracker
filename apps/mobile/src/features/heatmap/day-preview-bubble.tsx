import { nightColors } from "@habits/design-tokens";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { capitalizeFirst } from "@/lib/format.ts";

/** Fixed width: the preview never jumps while the finger sweeps. */
export const BUBBLE_WIDTH = 196;
const ARROW = 10;
/** Space between the arrow's tip and the square. */
const GAP = 6;

const ENTER = FadeIn.duration(120).reduceMotion(ReduceMotion.System);

/**
 * The day preview (2.10.0): what the web shows on hover, shown here while a
 * finger holds a square. Drawn over the grid, above the square (the finger
 * covers the square and what is below it). Visual only: the week elements
 * already read the day to screen readers.
 */
export function DayPreviewBubble({
	title,
	detail,
	left,
	arrowX,
	squareTop,
	containerHeight,
}: {
	title: string;
	detail: string;
	/** Left edge of the bubble in the container. */
	left: number;
	/** The square's center, in the container. */
	arrowX: number;
	/** Top of the square, in the container. */
	squareTop: number;
	containerHeight: number;
}) {
	const arrowLeft = Math.min(
		BUBBLE_WIDTH - ARROW * 2,
		Math.max(ARROW, arrowX - left - ARROW / 2)
	);
	return (
		<Animated.View
			entering={ENTER}
			pointerEvents="none"
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[
				styles.bubble,
				{ left, bottom: containerHeight - squareTop + GAP + ARROW / 2 },
			]}
		>
			<Text
				numberOfLines={1}
				maxFontSizeMultiplier={1.3}
				className="text-sm font-semibold text-night-foreground"
			>
				{capitalizeFirst(title)}
			</Text>
			<Text
				numberOfLines={1}
				maxFontSizeMultiplier={1.3}
				className="text-sm text-night-muted"
			>
				{detail}
			</Text>
			<View style={[styles.arrow, { left: arrowLeft }]} />
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	bubble: {
		position: "absolute",
		zIndex: 10,
		width: BUBBLE_WIDTH,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: nightColors.border.DEFAULT,
		backgroundColor: nightColors.surface.overlay,
	},
	arrow: {
		position: "absolute",
		bottom: -ARROW / 2 - 1,
		width: ARROW,
		height: ARROW,
		transform: [{ rotate: "45deg" }],
		backgroundColor: nightColors.surface.overlay,
		borderRightWidth: 1,
		borderBottomWidth: 1,
		borderColor: nightColors.border.DEFAULT,
	},
});
