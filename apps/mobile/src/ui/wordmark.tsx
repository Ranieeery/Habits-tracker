import { nightColors } from "@habits/design-tokens";
import { StyleSheet, View } from "react-native";
import { DisplayText } from "./display-text.tsx";

const SQUARES = [
	nightColors.heat[4],
	nightColors.heat[5],
	nightColors.heat[2],
	nightColors.heat[3],
];

/**
 * The mark (same as the web): four heatmap squares climbing in intensity and
 * the name in the display face. Plain Views, no SVG module.
 */
export function Wordmark() {
	return (
		<View
			accessible
			accessibilityRole="header"
			accessibilityLabel="Habits"
			className="flex-row items-center gap-2"
		>
			<View style={styles.mark}>
				{SQUARES.map((color, index) => (
					<View
						key={index}
						style={[styles.square, { backgroundColor: color }]}
					/>
				))}
			</View>
			<DisplayText
				maxFontSizeMultiplier={1.3}
				className="text-xl tracking-tight text-night-foreground"
			>
				Habits
			</DisplayText>
		</View>
	);
}

const styles = StyleSheet.create({
	mark: {
		width: 22,
		height: 22,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 2,
	},
	square: { width: 10, height: 10, borderRadius: 3 },
});
