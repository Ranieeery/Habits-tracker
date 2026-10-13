import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import {
	BACKFILL_DAYS,
	completionRatio,
	type DayEditState,
	getDayEditState,
	isCalendarDate,
	isDayEditable,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { isSettled, useDay, useHabits } from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import {
	capitalizeFirst,
	formatFullDate,
	formatLongDate,
	formatPercent,
	formatShortDate,
} from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { ProgressBar } from "@/ui/progress-bar.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { EditDayFooter } from "./edit-day-sheet.tsx";
import { HabitRow } from "./habit-row.tsx";
import { NewHabitSheet } from "./new-habit-sheet.tsx";
import { UpcomingSection } from "./upcoming-section.tsx";
import { useCompletionChange } from "./use-completion-change.ts";

const DAY_ENTER = FadeIn.duration(150).reduceMotion(ReduceMotion.System);

/** Route param: a `YYYY-MM-DD` date, or "hoje" (follows the day turning). */
export const TODAY_PARAM = "hoje";

export function DayScreen() {
	const { date: param } = useLocalSearchParams<{ date: string }>();
	const today = useToday();
	const date = param === TODAY_PARAM ? today : param;

	if (!date || !isCalendarDate(date)) {
		return (
			<Screen edges={[]}>
				<EmptyState
					title="Data inválida"
					description="Volte ao mapa e escolha um dia."
				/>
			</Screen>
		);
	}
	// Keyed by date: another day starts locked again.
	return <DayView key={date} date={date} today={today} />;
}

/**
 * The habits possible on `date` and their completion. Today is editable; a
 * past day inside the backfill window opens read-only and can be unlocked
 * with a confirmation ("Editar este dia" in the fixed footer); older and
 * future days stay read-only (core's `getDayEditState`). The unlock is
 * this component's state only, never stored: leaving the screen or changing
 * the day locks it again, while going to the background keeps it. Today has
 * "Novo hábito" in the same fixed footer: one-handed reach, and since the
 * list scrolls above it, it never covers the last habit or its checkbox.
 * Every change shows "Desfazer" (the inverse change, through the outbox).
 * Since 2.6.0 it is also the body of the Hoje tab (`inTabs`: under the
 * status bar instead of a native header, which it must not retitle, with the
 * tab's header and week strip in `header`).
 */
export function DayView({
	date,
	today,
	inTabs = false,
	header,
}: {
	date: CalendarDate;
	today: CalendarDate;
	inTabs?: boolean;
	header?: ReactNode;
}) {
	const router = useRouter();
	const day = useDay(date);
	const { change, dismissUndo } = useCompletionChange(date);
	const editState = getDayEditState(date, today);
	const [unlocked, setUnlocked] = useState(false);
	const isToday = editState === "today";
	const editable = isDayEditable(editState, unlocked);
	const hasHabits = (day.data?.possible_habits.length ?? 0) > 0;
	useHideSplashWhen(isSettled(day));

	let footer: ReactNode;
	if (isToday) footer = <NewHabitSheet today={today} />;
	else if (editState === "past_editable" && hasHabits) {
		footer = (
			<EditDayFooter
				date={date}
				unlocked={unlocked}
				onUnlock={() => setUnlocked(true)}
				onLock={() => {
					dismissUndo();
					setUnlocked(false);
				}}
			/>
		);
	}

	const [weekday = "", ...rest] = formatLongDate(date).split(", ");

	return (
		<Screen
			edges={inTabs ? ["top"] : []}
			inTabs={inTabs}
			onRefresh={() => void day.refetch()}
			refreshing={day.isRefetching}
			footer={footer}
		>
			{inTabs ? null : (
				<Stack.Screen
					options={{ title: isToday ? "Hoje" : formatShortDate(date) }}
				/>
			)}
			{header}
			<View className="gap-1">
				<Text className="text-sm font-semibold text-night-muted">
					{isToday ? "Hoje" : capitalizeFirst(rest.join(", "))}
				</Text>
				<DisplayText
					accessibilityRole="header"
					accessibilityLabel={formatFullDate(date)}
					className="text-3xl tracking-tight text-night-foreground"
				>
					{capitalizeFirst(weekday)}{" "}
					<Text className="text-night-muted">{formatShortDate(date)}</Text>
				</DisplayText>
			</View>

			{/* Changing the day (Hoje's strip) fades the new list in (150 ms). */}
			<Animated.View entering={DAY_ENTER} style={{ gap: 24 }}>
				<QueryState query={day} loadingLabel="Carregando o dia…">
					{(data) =>
						data.possible_habits.length === 0 && isToday ? (
							<TodayEmptyState />
						) : data.possible_habits.length === 0 ? (
							<EmptyState
								title="Nenhum hábito para este dia"
								description="Hábitos aparecem nos dias em que se repetem."
								action={
									<Button
										variant="outline"
										label="Gerenciar hábitos"
										onPress={() => router.navigate("/habits")}
									/>
								}
							/>
						) : (
							<DayContent
								possible={data.possible_habits}
								completedIds={new Set(data.completed_habit_ids)}
								editable={editable}
								editState={editState}
								unlocked={unlocked}
								onToggle={(habit, completed) => change(habit, completed)}
							/>
						)
					}
				</QueryState>
			</Animated.View>
			{isToday ? <UpcomingSection today={today} /> : null}
		</Screen>
	);
}

/** Today without habits: points at the footer's "Novo hábito" button. */
function TodayEmptyState() {
	const router = useRouter();
	const habits = useHabits();
	const hasActive = habits.data?.some((habit) => habit.archived_at === null);

	return hasActive ? (
		<EmptyState
			title="Nenhum hábito para hoje"
			description="Hábitos aparecem nos dias em que se repetem. Toque em Novo hábito, aqui embaixo, para criar outro."
			action={
				<Button
					variant="ghost"
					label="Gerenciar hábitos"
					onPress={() => router.navigate("/habits")}
				/>
			}
		/>
	) : (
		<EmptyState
			title="Nenhum hábito ainda"
			description="Toque em Novo hábito, aqui embaixo, para criar o primeiro. Ele começa a contar hoje."
		/>
	);
}

function DayContent({
	possible,
	completedIds,
	editable,
	editState,
	unlocked,
	onToggle,
}: {
	possible: Habit[];
	completedIds: Set<string>;
	editable: boolean;
	editState: DayEditState;
	unlocked: boolean;
	onToggle: (habit: Habit, completed: boolean) => void;
}) {
	const completed = possible.filter((habit) => completedIds.has(habit.id));
	const ratio = completionRatio(completed.length, possible.length);
	const summary = `${completed.length} de ${possible.length} concluídos (${formatPercent(ratio)})`;

	return (
		<>
			<View className="gap-2">
				<ProgressBar
					ratio={ratio}
					label="Progresso do dia"
					valueText={summary}
				/>
				<Text className="text-sm text-night-muted">{summary}</Text>
			</View>

			{editState === "past_editable" && unlocked ? (
				<View
					accessibilityLiveRegion="polite"
					className="flex-row items-center gap-3 rounded-xl border border-night-warning/60 bg-night-warning-surface px-4 py-3"
				>
					<MaterialCommunityIcons
						name="alert-outline"
						size={22}
						color={nightColors.warning.DEFAULT}
					/>
					<Text className="flex-1 font-semibold text-night-warning">
						Editando dia passado
					</Text>
				</View>
			) : !editable ? (
				<View className="flex-row items-center gap-2">
					<MaterialCommunityIcons
						name="lock-outline"
						size={16}
						color={nightColors.muted}
					/>
					<Text className="flex-1 text-sm text-night-muted">
						{READ_ONLY[editState]}
					</Text>
				</View>
			) : null}

			<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
				{possible.map((habit, index) => (
					<HabitRow
						key={habit.id}
						name={habit.name}
						checked={completedIds.has(habit.id)}
						disabled={!editable}
						divider={index > 0}
						onToggle={(checked) => onToggle(habit, checked)}
					/>
				))}
			</View>
		</>
	);
}

const READ_ONLY: Record<DayEditState, string> = {
	today: "",
	past_editable:
		"Somente leitura. Toque em Editar este dia, aqui embaixo, para alterar.",
	past_locked: `Fora do período de edição de ${BACKFILL_DAYS} dias`,
	future: "Somente leitura: este dia ainda não chegou.",
};
