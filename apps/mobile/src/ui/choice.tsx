import { Pressable, Text } from "react-native";

/**
 * A toggle chip (44 dp target): a checkbox in a multi-choice group, a radio
 * in a single-choice one.
 */
export function Choice({
	label,
	accessibilityLabel,
	selected,
	role = "checkbox",
	disabled = false,
	onPress,
	className = "",
}: {
	label: string;
	accessibilityLabel?: string;
	selected: boolean;
	role?: "checkbox" | "radio";
	disabled?: boolean;
	onPress: () => void;
	className?: string;
}) {
	return (
		<Pressable
			accessibilityRole={role}
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={
				role === "radio"
					? { selected, disabled }
					: { checked: selected, disabled }
			}
			disabled={disabled}
			onPress={onPress}
			className={`min-h-touch min-w-touch items-center justify-center rounded-md border-2 px-3 ${selected ? "border-violet-500 bg-violet-600" : "border-border bg-surface active:bg-border"} ${disabled ? "opacity-40" : ""} ${className}`}
		>
			<Text
				className={`text-base font-bold ${selected ? "text-foreground" : "text-muted"}`}
			>
				{label}
			</Text>
		</Pressable>
	);
}
