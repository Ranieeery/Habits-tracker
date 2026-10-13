import { nightColors } from "@habits/design-tokens";
import { type Ref, useId } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";

/** Labelled text input with an inline error announced to screen readers. */
export function TextField({
	label,
	error,
	hint,
	ref,
	...input
}: TextInputProps & {
	label: string;
	error?: string;
	hint?: string;
	ref?: Ref<TextInput>;
}) {
	const id = useId();
	return (
		<View className="gap-2">
			<Text
				nativeID={id}
				className="text-sm font-semibold text-night-foreground"
			>
				{label}
			</Text>
			<TextInput
				ref={ref}
				accessibilityLabel={label}
				accessibilityLabelledBy={id}
				accessibilityHint={hint}
				placeholderTextColor={nightColors.muted}
				selectionColor={nightColors.accent.text}
				cursorColor={nightColors.accent.text}
				className={`min-h-touch rounded-md border-2 bg-night-bg px-4 py-3 text-base text-night-foreground ${error ? "border-night-danger" : "border-night-border-strong focus:border-night-accent-text"}`}
				{...input}
			/>
			{hint && !error ? (
				<Text className="text-sm text-night-muted">{hint}</Text>
			) : null}
			<FieldError>{error}</FieldError>
		</View>
	);
}

export function FieldError({ children }: { children?: string }) {
	if (!children) return null;
	return (
		<Text
			accessibilityLiveRegion="polite"
			accessibilityRole="alert"
			className="text-sm text-night-danger"
		>
			{children}
		</Text>
	);
}
