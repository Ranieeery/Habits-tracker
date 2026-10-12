import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, nightColors } from "@habits/design-tokens";
import type { ComponentProps, Ref } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const CONTAINER: Record<Variant, string> = {
	primary: "bg-violet-600 active:bg-violet-700",
	secondary: "border border-border bg-surface active:bg-border",
	outline: "border-2 border-accent active:bg-surface",
	ghost: "active:bg-surface",
	danger: "border border-danger active:bg-danger-surface",
};

// Text on the accent uses accent-on (4.7:1); the foreground would be 4.2:1.
const LABEL: Record<Variant, string> = {
	primary: "text-night-accent-on",
	secondary: "text-foreground",
	outline: "text-foreground",
	ghost: "text-muted",
	danger: "text-danger",
};

const ICON_COLOR: Record<Variant, string> = {
	primary: nightColors.accent.on,
	secondary: colors.foreground,
	outline: colors.accent.DEFAULT,
	ghost: colors.muted,
	danger: colors.danger.DEFAULT,
};

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Button({
	label,
	onPress,
	variant = "primary",
	icon,
	pending = false,
	disabled = false,
	accessibilityHint,
	className = "",
	ref,
}: {
	label: string;
	onPress: () => void;
	variant?: Variant;
	icon?: IconName;
	pending?: boolean;
	disabled?: boolean;
	accessibilityHint?: string;
	className?: string;
	/** For giving the accessibility focus back (e.g. after a sheet closes). */
	ref?: Ref<View>;
}) {
	const inactive = disabled || pending;
	return (
		<Pressable
			ref={ref}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: inactive, busy: pending }}
			disabled={inactive}
			onPress={onPress}
			className={`min-h-touch flex-row items-center justify-center gap-2 rounded-md px-5 py-3 ${CONTAINER[variant]} ${inactive ? "opacity-50" : ""} ${className}`}
		>
			{pending ? (
				<ActivityIndicator color={ICON_COLOR[variant]} size="small" />
			) : icon ? (
				<MaterialCommunityIcons
					name={icon}
					size={20}
					color={ICON_COLOR[variant]}
				/>
			) : null}
			<Text className={`text-base font-semibold ${LABEL[variant]}`}>
				{label}
			</Text>
		</Pressable>
	);
}

/** Square icon-only button with a 44 dp target. */
export function IconButton({
	icon,
	label,
	disabled = false,
	onPress,
}: {
	icon: IconName;
	label: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			hitSlop={4}
			className={`size-touch items-center justify-center rounded-md active:bg-surface ${disabled ? "opacity-30" : ""}`}
		>
			<View>
				<MaterialCommunityIcons name={icon} size={24} color={colors.muted} />
			</View>
		</Pressable>
	);
}
