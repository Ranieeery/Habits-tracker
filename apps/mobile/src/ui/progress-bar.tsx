import { View } from "react-native";

/** `ratio` in [0, 1] (from `completionRatio` in @habits/core). */
export function ProgressBar({
	ratio,
	label,
	valueText,
}: {
	ratio: number;
	label: string;
	valueText: string;
}) {
	const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max: 100, now: percent, text: valueText }}
			className="h-3 w-full overflow-hidden rounded-lg bg-track"
		>
			<View
				className="h-full rounded-lg bg-violet-600"
				style={{ width: `${percent}%` }}
			/>
		</View>
	);
}
