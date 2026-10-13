import { nightColors, TOUCH_TARGET_MIN } from "@habits/design-tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconButton } from "./button.tsx";

/**
 * Days of the month as a calendar (2.7.0, same look as `DatePicker`): 7
 * columns that fill the width, 44 dp borderless days, the chosen ones in
 * `night-accent`, each inside its own 2 dp margin so neighbors chosen side
 * by side stay separate squares. Multiple choice for "Dias do mês" (no
 * month or year); single for "Todo ano", where `onPrevious`/`onNext` add
 * arrows that page through the months, like "Começa em".
 */
export function MonthDayPicker({
	title,
	days,
	selected,
	role,
	onPress,
	onPrevious,
	onNext,
}: {
	title: string;
	/** How many days to offer (31, or the shown month's length). */
	days: number;
	selected: (day: number) => boolean;
	role: "checkbox" | "radio";
	onPress: (day: number) => void;
	onPrevious?: () => void;
	onNext?: () => void;
}) {
	const cells: (number | null)[] = Array.from(
		{ length: days },
		(_, i) => i + 1
	);
	while (cells.length % 7 !== 0) cells.push(null);
	const rows: (number | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

	return (
		<View
			accessibilityRole={role === "radio" ? "radiogroup" : undefined}
			className="gap-1 rounded-xl border border-night-border bg-night-surface p-2"
		>
			<View className="flex-row items-center justify-between">
				{onPrevious ? (
					<IconButton
						icon="chevron-left"
						label="Mês anterior"
						onPress={onPrevious}
					/>
				) : (
					<View className="size-touch" />
				)}
				<Text
					accessibilityRole="header"
					accessibilityLiveRegion="polite"
					className="py-2 text-center text-base font-semibold text-night-foreground"
				>
					{title}
				</Text>
				{onNext ? (
					<IconButton
						icon="chevron-right"
						label="Próximo mês"
						onPress={onNext}
					/>
				) : (
					<View className="size-touch" />
				)}
			</View>
			{rows.map((row, index) => (
				<View key={index} className="flex-row">
					{row.map((day, column) =>
						day === null ? (
							<View key={`empty-${column}`} className="min-h-touch flex-1" />
						) : (
							<DayButton
								key={day}
								day={day}
								role={role}
								selected={selected(day)}
								onPress={() => onPress(day)}
							/>
						)
					)}
				</View>
			))}
		</View>
	);
}

/**
 * One day. Its look is in `style`, not `className`: a class that changes
 * after the first render lost its margin on the device (NativeWind), and a
 * background added after mounting drew square corners (Android), so chosen
 * neighbors merged into a band.
 */
function DayButton({
	day,
	role,
	selected,
	onPress,
}: {
	day: number;
	role: "checkbox" | "radio";
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole={role}
			accessibilityLabel={`Dia ${day}`}
			accessibilityState={
				role === "radio" ? { selected } : { checked: selected }
			}
			onPress={onPress}
			style={styles.slot}
		>
			{({ pressed }) => (
				<View
					style={[
						styles.day,
						selected ? styles.selected : pressed ? styles.pressed : undefined,
					]}
				>
					<Text
						style={[styles.label, selected ? styles.labelSelected : undefined]}
					>
						{day}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	slot: { flex: 1, minHeight: TOUCH_TARGET_MIN, padding: 2 },
	day: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 8,
		// Always a background (the panel's own color): on Android a View that
		// gets its first background after mounting drew square corners.
		backgroundColor: nightColors.surface.DEFAULT,
	},
	selected: { backgroundColor: nightColors.accent.DEFAULT },
	pressed: { backgroundColor: nightColors.surface.raised },
	label: {
		fontSize: 16,
		color: nightColors.foreground,
		fontVariant: ["tabular-nums"],
	},
	labelSelected: { fontWeight: "700", color: nightColors.accent.on },
});
