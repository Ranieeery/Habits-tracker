import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Habit, isSupportedSchedule } from "@habits/contracts";
import { isDeadlineSettled } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
	LinearTransition,
	ReduceMotion,
} from "react-native-reanimated";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import {
	isSettled,
	useDeadlineFirsts,
	useHabits,
	useReorderHabit,
} from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import { TabHeader } from "@/features/shell/tab-header.tsx";
import { Button, IconButton } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { useToast } from "@/ui/toast.tsx";
import { HabitCard } from "./habit-card.tsx";

const REORDER = LinearTransition.duration(200).reduceMotion(
	ReduceMotion.System
);

/** A single-date habit whose date has passed (kept, not archived). */
function isPastOnce(habit: Habit, today: string): boolean {
	return (
		isSupportedSchedule(habit.schedule) &&
		habit.schedule.type === "once" &&
		habit.schedule.date < today
	);
}

/**
 * The Hábitos tab (2.6.0 identity): cards like the web's, "Novo hábito" in
 * the fixed footer (thumb's reach, as on Hoje), and a "Reordenar" mode with
 * up/down buttons (44 dp) that move a habit through the outbox, offline too.
 * The mode lives in memory and ends when the tab loses focus.
 */
export function HabitsScreen() {
	const router = useRouter();
	const habits = useHabits();
	const firsts = useDeadlineFirsts();
	const today = useToday();
	const toast = useToast();
	const [showPast, setShowPast] = useState(false);
	const [reordering, setReordering] = useState(false);
	const { move } = useReorderHabit((error) => {
		if (!isUnauthorized(error)) {
			toast("error", "Não foi possível mover o hábito", errorMessage(error));
		}
	});
	useHideSplashWhen(isSettled(habits));
	useFocusEffect(useCallback(() => () => setReordering(false), []));

	const open = (habit: Habit) =>
		router.push({ pathname: "/habit/[id]", params: { id: habit.id } });

	return (
		<Screen
			inTabs
			onRefresh={() => void habits.refetch()}
			refreshing={habits.isRefetching}
			footer={
				<Button
					icon="plus"
					label="Novo hábito"
					accessibilityHint="Cria um hábito"
					onPress={() => router.push("/habit/new")}
				/>
			}
		>
			<TabHeader
				title={
					<DisplayText
						accessibilityRole="header"
						className="text-3xl tracking-tight text-night-foreground"
					>
						Hábitos
					</DisplayText>
				}
			/>

			<QueryState query={habits} loadingLabel="Carregando hábitos…">
				{(list) => {
					const live = list.filter((habit) => habit.archived_at === null);
					// Past single dates, and deadline tasks done or past their
					// overdue window (2.13.0), go to "Passados".
					const isPast = (habit: Habit) =>
						isPastOnce(habit, today) ||
						isDeadlineSettled(habit, firsts.data?.[habit.id], today);
					const active = live.filter((habit) => !isPast(habit));
					const past = live.filter(isPast);
					const archived = list.filter((habit) => habit.archived_at !== null);
					if (list.length === 0) {
						return (
							<EmptyState
								title="Nenhum hábito ainda"
								description="Escolha um nome e como ele se repete: dias da semana, a cada N dias, dias do mês, uma data ou todo ano. Toque em Novo hábito, aqui embaixo."
							/>
						);
					}
					return (
						<View className="gap-8">
							<View className="gap-3">
								{active.length > 1 ? (
									<View className="flex-row items-center justify-between">
										<Text className="flex-1 text-sm text-night-muted">
											{reordering
												? "Use as setas para mudar a ordem."
												: "Na ordem em que aparecem em Hoje."}
										</Text>
										<Button
											variant="ghost"
											icon={reordering ? "check" : "swap-vertical"}
											label={reordering ? "Concluir" : "Reordenar"}
											onPress={() => setReordering((on) => !on)}
										/>
									</View>
								) : null}
								{active.length === 0 ? (
									<Text className="text-night-muted">
										Todos os hábitos estão arquivados.
									</Text>
								) : (
									<View className="gap-2">
										{active.map((habit, index) => (
											// A moved card slides to its new place (200 ms).
											<Animated.View key={habit.id} layout={REORDER}>
												<HabitCard
													habit={habit}
													today={today}
													onPress={reordering ? undefined : () => open(habit)}
													actions={
														reordering ? (
															<View className="flex-row pr-1">
																<IconButton
																	icon="arrow-up"
																	label={`Subir ${habit.name}`}
																	disabled={index === 0}
																	onPress={() =>
																		move(active, habit.id, index - 1)
																	}
																/>
																<IconButton
																	icon="arrow-down"
																	label={`Descer ${habit.name}`}
																	disabled={index === active.length - 1}
																	onPress={() =>
																		move(active, habit.id, index + 1)
																	}
																/>
															</View>
														) : undefined
													}
												/>
											</Animated.View>
										))}
									</View>
								)}
							</View>
							{past.length > 0 ? (
								<View className="gap-3">
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ expanded: showPast }}
										accessibilityHint="Mostra ou esconde as datas únicas que já passaram"
										onPress={() => setShowPast((isOpen) => !isOpen)}
										className="min-h-touch flex-row items-center justify-between rounded-xl border border-night-border px-4 active:bg-night-surface-raised"
									>
										<Text className="text-sm font-semibold text-night-muted">
											Passados ({past.length})
										</Text>
										<MaterialCommunityIcons
											name={showPast ? "chevron-up" : "chevron-down"}
											size={24}
											color={nightColors.muted}
										/>
									</Pressable>
									{showPast ? (
										<View className="gap-2">
											{past.map((habit) => (
												<HabitCard
													key={habit.id}
													habit={habit}
													today={today}
													muted
													onPress={() => open(habit)}
												/>
											))}
										</View>
									) : null}
								</View>
							) : null}
							{archived.length > 0 ? (
								<View className="gap-3">
									<Text
										accessibilityRole="header"
										className="text-sm font-semibold text-night-muted"
									>
										Arquivados
									</Text>
									<View className="gap-2">
										{archived.map((habit) => (
											<HabitCard
												key={habit.id}
												habit={habit}
												today={today}
												muted
												onPress={() => open(habit)}
											/>
										))}
									</View>
								</View>
							) : null}
						</View>
					);
				}}
			</QueryState>
		</Screen>
	);
}
