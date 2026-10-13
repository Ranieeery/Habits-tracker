import { Pressable, Text, View } from "react-native";
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
			className="min-h-touch flex-1 p-0.5"
		>
			{({ pressed }) => (
				<View
					className={`flex-1 items-center justify-center rounded-md ${selected ? "bg-night-accent" : pressed ? "bg-night-surface-raised" : ""}`}
				>
					<Text
						className={`text-base ${selected ? "font-bold text-night-accent-on" : "text-night-foreground"}`}
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{day}
					</Text>
				</View>
			)}
		</Pressable>
	);
}
