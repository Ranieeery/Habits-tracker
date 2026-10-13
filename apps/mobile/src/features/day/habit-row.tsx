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
	descriptionLine = "",
	onShowDescription,
	onToggle,
}: {
	name: string;
	checked: boolean;
	disabled: boolean;
	divider: boolean;
	overdue?: OverdueLabel | null;
	/** The description's first line, under the name (2.12.0). */
	descriptionLine?: string;
	/** Present when the habit has a description (2.12.0): the note icon. */
	onShowDescription?: () => void;
	onToggle: (checked: boolean) => void;
}) {
	return (
		<View
			className={`flex-row items-center ${divider ? "border-t border-night-border" : ""}`}
		>
			<Pressable
				accessibilityRole="checkbox"
				accessibilityLabel={overdue ? `${name}, ${overdue.spoken}` : name}
				accessibilityState={{ checked, disabled }}
				disabled={disabled}
				onPress={() => onToggle(!checked)}
				className={`min-h-14 flex-1 flex-row items-center gap-4 px-4 py-3 active:bg-night-surface-raised ${onShowDescription ? "pr-1" : ""}`}
			>
				<CheckboxBox checked={checked} />
				<View className="flex-1 items-start gap-1.5">
					<Text
						className={`text-base font-medium ${checked ? "text-night-muted line-through" : "text-night-foreground"} ${disabled && !checked ? "opacity-80" : ""}`}
					>
						{name}
					</Text>
					{descriptionLine ? (
						<Text
							numberOfLines={1}
							className={`self-stretch text-sm text-night-muted ${checked ? "opacity-70" : ""}`}
						>
							{descriptionLine}
						</Text>
					) : null}
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
			{/* Its own target, outside the checkbox: marking stays a tap on the row. */}
			{onShowDescription ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Descrição de ${name}`}
					onPress={onShowDescription}
					className="mr-2 size-touch items-center justify-center rounded-md active:bg-night-surface-raised"
				>
					<MaterialCommunityIcons
						name="text-box-outline"
						size={22}
						color={nightColors.muted}
					/>
				</Pressable>
			) : null}
		</View>
	);
}
