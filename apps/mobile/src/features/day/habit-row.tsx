import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { OverdueLabel } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { Pressable, Text, View } from "react-native";
import { CheckboxBox } from "@/ui/checkbox.tsx";

/**
 * One habit of a day (DESIGN.md "Linha de hábito"): the whole row is the
 * target (44 dp+), the checkbox on the left, the name struck through in
 * `night-muted` when done. Rows sit in one `night-surface` panel, divided by
 * `night-border` lines. Shared by the Hoje tab and the day screen. An overdue
 * habit (2.8.0) carries the "Atrasado desde 11/10" badge below the name
 * (icon and text, never color alone), read as "Nome, atrasado desde 11 de
 * outubro".
 */
export function HabitRow({
	name,
	checked,
	disabled,
	divider,
	overdue = null,
	onToggle,
}: {
	name: string;
	checked: boolean;
	disabled: boolean;
	divider: boolean;
	overdue?: OverdueLabel | null;
	onToggle: (checked: boolean) => void;
}) {
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={overdue ? `${name}, ${overdue.spoken}` : name}
			accessibilityState={{ checked, disabled }}
			disabled={disabled}
			onPress={() => onToggle(!checked)}
			className={`min-h-14 flex-row items-center gap-4 px-4 py-3 active:bg-night-surface-raised ${divider ? "border-t border-night-border" : ""}`}
		>
			<CheckboxBox checked={checked} />
			<View className="flex-1 items-start gap-1.5">
				<Text
					className={`text-base font-medium ${checked ? "text-night-muted line-through" : "text-night-foreground"} ${disabled && !checked ? "opacity-80" : ""}`}
				>
					{name}
				</Text>
				{overdue ? (
					<View
						importantForAccessibility="no-hide-descendants"
						className="flex-row items-center gap-1 rounded-md border border-night-warning/60 bg-night-warning-surface px-2 py-0.5"
					>
						<MaterialCommunityIcons
							name="calendar-clock"
							size={14}
							color={nightColors.warning.DEFAULT}
						/>
						<Text className="text-xs font-medium text-night-warning">
							{overdue.text}
						</Text>
					</View>
				) : null}
			</View>
		</Pressable>
	);
}
