import { Pressable, Text } from "react-native";
import { CheckboxBox } from "@/ui/checkbox.tsx";

/**
 * One habit of a day (DESIGN.md "Linha de hábito"): the whole row is the
 * target (44 dp+), the checkbox on the left, the name struck through in
 * `night-muted` when done. Rows sit in one `night-surface` panel, divided by
 * `night-border` lines. Shared by the Hoje tab and the day screen.
 */
export function HabitRow({
	name,
	checked,
	disabled,
	divider,
	onToggle,
}: {
	name: string;
	checked: boolean;
	disabled: boolean;
	divider: boolean;
	onToggle: (checked: boolean) => void;
}) {
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={name}
			accessibilityState={{ checked, disabled }}
			disabled={disabled}
			onPress={() => onToggle(!checked)}
			className={`min-h-14 flex-row items-center gap-4 px-4 py-3 active:bg-night-surface-raised ${divider ? "border-t border-night-border" : ""}`}
		>
			<CheckboxBox checked={checked} />
			<Text
				className={`flex-1 text-base font-medium ${checked ? "text-night-muted line-through" : "text-night-foreground"} ${disabled && !checked ? "opacity-80" : ""}`}
			>
				{name}
			</Text>
		</Pressable>
	);
}
