import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
	ARCHIVED_BADGE,
	type DeadlineLabel,
	habitMenuLabel,
	type OverdueLabel,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import * as Haptics from "expo-haptics";
import { type Ref, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckboxBox } from "@/ui/checkbox.tsx";
import { LONG_PRESS_MS } from "./long-press.ts";

/**
 * One habit of a day (DESIGN.md "Linha de hábito"): the whole row is the
 * target (44 dp+), the checkbox on the left, the name struck through in
 * `night-muted` when done. Rows sit in one `night-surface` panel, divided by
 * `night-border` lines. Shared by the Hoje tab and the day screen. An overdue
 * habit (2.8.0) carries the "Atrasado desde 11/10" badge below the name
 * (icon and text, never color alone), read as "Nome, atrasado desde 11 de
 * outubro".
 * 2.15.0: with `onShowActions` (the Hoje tab and, since 2.16.1, days
 * opened from the history), the "more options"
 * button (⋮) at the end opens the habit's actions sheet, and so does holding
 * the row for `LONG_PRESS_MS` (light haptic when it opens; releasing then
 * never marks). A shorter press still marks. With it, read-only rows are not
 * disabled (the long press must work), but a tap does nothing and they still
 * read as disabled. Without it, neither. An
 * archived habit still listed (today or a past day) carries the "Arquivado"
 * badge. 2.16.0: a postponed occurrence on its new day carries "Adiado de
 * 20/10" (icon and text, neutral), read with the name.
 */
export function HabitRow({
	name,
	checked,
	disabled,
	divider,
	overdue = null,
	due = null,
	doneOn = null,
	descriptionLine = "",
	onShowDescription,
	archived = false,
	moved = null,
	onShowActions,
	onToggle,
}: {
	name: string;
	checked: boolean;
	disabled: boolean;
	divider: boolean;
	overdue?: OverdueLabel | null;
	/** An open deadline task (2.13.0): "Até 20/10 · faltam 7 dias". */
	due?: DeadlineLabel | null;
	/**
	 * A deadline task first completed on another day (2.13.0): "Já concluída
	 * em 22/10", no checkbox to mark it again.
	 */
	doneOn?: { text: string; spoken: string } | null;
	/** The description's first line, under the name (2.12.0). */
	descriptionLine?: string;
	/** Present when the habit has a description (2.12.0): the note icon. */
	onShowDescription?: () => void;
	archived?: boolean;
	/** 2.16.0: "Adiado de 20/10". */
	moved?: { text: string; spoken: string } | null;
	/**
	 * Opens the actions sheet (every day screen); `origin` gets the focus
	 * back on closing.
	 */
	onShowActions?: (origin: View | null) => void;
	onToggle: (checked: boolean) => void;
}) {
	const more = useRef<View>(null);
	const locked = disabled || doneOn !== null;
	const showActions = (fromHold: boolean) => {
		if (fromHold) {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		onShowActions?.(more.current);
	};
	return (
		<View
			className={`flex-row items-center ${divider ? "border-t border-night-border" : ""}`}
		>
			<Pressable
				accessibilityRole="checkbox"
				accessibilityLabel={[
					name,
					overdue?.spoken,
					due?.spoken,
					moved?.spoken,
					doneOn?.spoken,
					archived && "arquivado",
				]
					.filter(Boolean)
					.join(", ")}
				accessibilityState={{
					checked: checked || doneOn !== null,
					disabled: locked,
				}}
				// Without the menu the row is simply disabled when locked.
				disabled={!onShowActions && locked}
				onPress={() => {
					if (!locked) onToggle(!checked);
				}}
				onLongPress={onShowActions ? () => showActions(true) : undefined}
				delayLongPress={LONG_PRESS_MS}
				className={`min-h-14 flex-1 flex-row items-center gap-4 py-3 pl-4 active:bg-night-surface-raised ${onShowDescription || onShowActions ? "pr-1" : "pr-4"}`}
			>
				<View className={doneOn ? "opacity-40" : ""}>
					<CheckboxBox checked={checked || doneOn !== null} />
				</View>
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
					{due ? (
						<View
							importantForAccessibility="no-hide-descendants"
							className={`flex-row items-center gap-1 rounded-md border px-2 py-0.5 ${due.dueToday ? "border-night-warning/60 bg-night-warning-surface" : "border-night-accent/40 bg-night-accent/15"}`}
						>
							<MaterialCommunityIcons
								name="calendar-end"
								size={14}
								color={
									due.dueToday
										? nightColors.warning.DEFAULT
										: nightColors.accent.text
								}
							/>
							<Text
								className={`text-xs font-medium ${due.dueToday ? "text-night-warning" : "text-night-accent-text"}`}
							>
								{due.text}
							</Text>
						</View>
					) : null}
					{moved ? (
						<View
							importantForAccessibility="no-hide-descendants"
							className="flex-row items-center gap-1 rounded-md border border-night-border-strong px-2 py-0.5"
						>
							<MaterialCommunityIcons
								name="calendar-arrow-right"
								size={14}
								color={nightColors.muted}
							/>
							<Text className="text-xs font-medium text-night-muted">
								{moved.text}
							</Text>
						</View>
					) : null}
					{archived ? (
						<View
							importantForAccessibility="no-hide-descendants"
							className="flex-row items-center gap-1 rounded-md border border-night-border-strong px-2 py-0.5"
						>
							<MaterialCommunityIcons
								name="archive-outline"
								size={14}
								color={nightColors.muted}
							/>
							<Text className="text-xs font-medium text-night-muted">
								{ARCHIVED_BADGE}
							</Text>
						</View>
					) : null}
					{doneOn ? (
						<Text
							importantForAccessibility="no"
							className="text-xs text-night-muted"
						>
							{doneOn.text}
						</Text>
					) : null}
				</View>
			</Pressable>
			{/* Its own target, outside the checkbox: marking stays a tap on the row. */}
			{onShowDescription ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Descrição de ${name}`}
					onPress={onShowDescription}
					className={`size-touch items-center justify-center rounded-md active:bg-night-surface-raised ${onShowActions ? "" : "mr-2"}`}
				>
					<MaterialCommunityIcons
						name="text-box-outline"
						size={22}
						color={nightColors.muted}
					/>
				</Pressable>
			) : null}
			{/* Its own target too: opening the menu never marks the habit. */}
			{onShowActions ? (
				<MoreOptionsButton
					ref={more}
					name={name}
					onPress={() => showActions(false)}
				/>
			) : null}
		</View>
	);
}

/**
 * The always visible "more options" button (⋮) at a row's end (2.15.0):
 * `night-muted`, a 44 dp target plus a small hit slop, its own target so it
 * never marks the habit.
 */
export function MoreOptionsButton({
	ref,
	name,
	onPress,
}: {
	ref?: Ref<View>;
	name: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			ref={ref}
			accessibilityRole="button"
			accessibilityLabel={habitMenuLabel(name)}
			onPress={onPress}
			hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
			className="mr-1 size-touch items-center justify-center rounded-md active:bg-night-surface-raised"
		>
			<MaterialCommunityIcons
				name="dots-vertical"
				size={22}
				color={nightColors.muted}
			/>
		</Pressable>
	);
}
