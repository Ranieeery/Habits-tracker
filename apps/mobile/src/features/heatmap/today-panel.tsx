import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import { nightColors } from "@habits/design-tokens";
import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { useDay } from "@/data/hooks.ts";
import { useCompletionChange } from "@/features/day/use-completion-change.ts";
import { DisplayText } from "@/ui/display-text.tsx";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";
import { SkeletonBlock } from "./heatmap-states.tsx";

/**
 * Today's habits on the home screen, in the lower part where the thumb
 * reaches: the daily action without leaving the heatmap. Same data and
 * feedback as the day screen (`useCompletionChange`: optimistic through the
 * outbox, offline too, haptic, "Desfazer"); the full day ("Próximos", "Novo
 * hábito") stays one tap away.
 */
export function TodayPanel({
	today,
	onOpenToday,
}: {
	today: CalendarDate;
	onOpenToday: () => void;
}) {
	const day = useDay(today);
	const { change } = useCompletionChange(today);
	const reduced = useReducedMotion();
	const habits = day.data?.possible_habits ?? [];
	const done = new Set(day.data?.completed_habit_ids ?? []);
	const doneCount = habits.filter((habit) => done.has(habit.id)).length;

	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			<View className="flex-row items-baseline justify-between gap-3 px-4 pt-4 pb-2">
				<DisplayText
					weight="semibold"
					accessibilityRole="header"
					className="text-xl text-night-foreground"
				>
					Hoje
				</DisplayText>
				{habits.length > 0 ? (
					<Text
						accessibilityLabel={`${doneCount} de ${habits.length} concluídos`}
						className="text-sm text-night-muted"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{doneCount} de {habits.length}
					</Text>
				) : null}
			</View>

			{day.data === undefined ? (
				<View
					importantForAccessibility="no-hide-descendants"
					className="gap-3 px-4 py-3"
				>
					<SkeletonBlock className="h-6 w-2/3 rounded-sm" />
					<SkeletonBlock className="h-6 w-1/2 rounded-sm" />
				</View>
			) : habits.length === 0 ? (
				<Text className="px-4 py-2 text-sm text-night-muted">
					Nenhum hábito para hoje.
				</Text>
			) : (
				<View>
					{habits.map((habit) => (
						<TodayRow
							key={habit.id}
							habit={habit}
							checked={done.has(habit.id)}
							reduced={reduced}
							onToggle={() => change(habit, !done.has(habit.id))}
						/>
					))}
				</View>
			)}

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Abrir o dia de hoje"
				accessibilityHint="Mostra também os próximos e permite criar um hábito"
				onPress={onOpenToday}
				className="mt-1 min-h-touch flex-row items-center justify-between border-t border-night-border px-4 active:bg-night-surface-raised"
			>
				<Text className="text-sm font-semibold text-night-accent-text">
					Abrir o dia de hoje
				</Text>
				<MaterialCommunityIcons
					name="chevron-right"
					size={20}
					color={nightColors.accent.text}
				/>
			</Pressable>
		</View>
	);
}

function TodayRow({
	habit,
	checked,
	reduced,
	onToggle,
}: {
	habit: Habit;
	checked: boolean;
	reduced: boolean;
	onToggle: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={habit.name}
			accessibilityState={{ checked }}
			onPress={onToggle}
			className="min-h-touch flex-row items-center gap-3 px-4 py-2 active:bg-night-surface-raised"
		>
			<NightCheckbox checked={checked} reduced={reduced} />
			<Text
				className={`flex-1 text-base ${checked ? "text-night-muted line-through" : "text-night-foreground"}`}
			>
				{habit.name}
			</Text>
		</Pressable>
	);
}

/** Visual only (the row is the target), with a short pulse when checked. */
function NightCheckbox({
	checked,
	reduced,
}: {
	checked: boolean;
	reduced: boolean;
}) {
	const scale = useSharedValue(1);
	const previous = useRef(checked);
	useEffect(() => {
		const becameChecked = checked && !previous.current;
		previous.current = checked;
		if (!becameChecked || reduced) return;
		scale.set(
			withSequence(
				withTiming(1.2, { duration: 120, easing: Easing.out(Easing.quad) }),
				withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) })
			)
		);
	}, [checked, reduced, scale]);
	const pulse = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));

	return (
		<Animated.View style={pulse}>
			<View
				className={`size-6 items-center justify-center rounded-md border ${checked ? "border-night-success bg-night-success" : "border-night-border-strong bg-night-bg"}`}
			>
				{checked ? (
					<MaterialCommunityIcons
						name="check-bold"
						size={16}
						color={nightColors.bg}
					/>
				) : null}
			</View>
		</Animated.View>
	);
}
