import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate } from "@habits/contracts";
import { type MovedOutItem, movedOutLabel } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { Text, View } from "react-native";

/**
 * The occurrences postponed away from the day shown (2.16.0): read-only
 * notes "Pagar conta · Adiado para 27/10", without a checkbox, so the habit
 * missing from the list is explained. Only on today (the Hoje tab) and the
 * preview days; the history stays as it was.
 */
export function MovedOutNotes({
	items,
	today,
}: {
	items: readonly MovedOutItem[] | undefined;
	today: CalendarDate;
}) {
	if (!items || items.length === 0) return null;
	return (
		<View className="gap-1">
			{items.map(({ habit, toDate }) => {
				const label = movedOutLabel(toDate, today);
				return (
					<View
						key={habit.id}
						accessible
						accessibilityLabel={`${habit.name}, ${label.spoken}`}
						className="min-h-touch flex-row items-center gap-3 px-1"
					>
						<MaterialCommunityIcons
							name="calendar-arrow-right"
							size={20}
							color={nightColors.subtle}
						/>
						<Text className="flex-1 text-sm text-night-muted">
							<Text className="text-night-foreground">{habit.name}</Text>
							{` · ${label.text}`}
						</Text>
					</View>
				);
			})}
		</View>
	);
}
