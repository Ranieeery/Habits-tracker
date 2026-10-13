import type { Habit } from "@habits/contracts";
import { ScrollView, Text } from "react-native";
import { PressableScale } from "@/ui/pressable-scale.tsx";

/**
 * One row of chips above the grid (2.7.0): "Todos" and each active habit in
 * the user's order. A chosen habit makes the grid and the numbers about it
 * alone. Hidden when there is only one habit (nothing to filter).
 */
export function HabitFilter({
	habits,
	selected,
	onSelect,
}: {
	habits: readonly Habit[];
	selected: string | null;
	onSelect: (habitId: string | null) => void;
}) {
	if (habits.length < 2) return null;
	const chips = [
		{ id: null, name: "Todos" },
		...habits.map((habit) => ({ id: habit.id, name: habit.name })),
	];
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			accessibilityRole="tablist"
			accessibilityLabel="Filtrar por hábito"
			contentContainerStyle={{ gap: 8, paddingRight: 16 }}
			style={{ marginHorizontal: -16 }}
		>
			{chips.map((chip, index) => {
				const chosen = chip.id === selected;
				return (
					<PressableScale
						key={chip.id ?? "all"}
						accessibilityRole="tab"
						accessibilityState={{ selected: chosen }}
						onPress={() => onSelect(chip.id)}
						style={index === 0 ? { marginLeft: 16 } : undefined}
						className={`min-h-touch justify-center rounded-full px-4 ${chosen ? "bg-night-accent" : "border border-night-border active:bg-night-surface-raised"}`}
					>
						<Text
							numberOfLines={1}
							className={`max-w-48 text-sm ${chosen ? "font-semibold text-night-accent-on" : "text-night-muted"}`}
						>
							{chip.name}
						</Text>
					</PressableScale>
				);
			})}
		</ScrollView>
	);
}
