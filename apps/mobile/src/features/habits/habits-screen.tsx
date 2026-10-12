import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Habit, isSupportedSchedule } from "@habits/contracts";
import { formatSchedule } from "@habits/core";
import { colors } from "@habits/design-tokens";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isSettled, useHabits } from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";

function scheduleText(habit: Habit, today: string): string {
	return formatSchedule(habit.schedule, { today });
}

/** A single-date habit whose date has passed (kept, not archived). */
function isPastOnce(habit: Habit, today: string): boolean {
	return (
		isSupportedSchedule(habit.schedule) &&
		habit.schedule.type === "once" &&
		habit.schedule.date < today
	);
}

export function HabitsScreen() {
	const router = useRouter();
	const habits = useHabits();
	const today = useToday();
	const [showPast, setShowPast] = useState(false);
	useHideSplashWhen(isSettled(habits));

	return (
		<Screen
			onRefresh={() => void habits.refetch()}
			refreshing={habits.isRefetching}
		>
			<View className="flex-row items-center justify-between gap-4">
				<Text
					accessibilityRole="header"
					className="text-3xl font-extrabold text-foreground"
				>
					Hábitos
				</Text>
				<Button
					variant="outline"
					icon="plus"
					label="Novo"
					accessibilityHint="Cria um hábito"
					onPress={() => router.push("/habit/new")}
				/>
			</View>

			<QueryState query={habits} loadingLabel="Carregando hábitos…">
				{(list) => {
					const live = list.filter((habit) => habit.archived_at === null);
					const active = live.filter((habit) => !isPastOnce(habit, today));
					const past = live.filter((habit) => isPastOnce(habit, today));
					const archived = list.filter((habit) => habit.archived_at !== null);
					if (list.length === 0) {
						return (
							<EmptyState
								title="Nenhum hábito ainda"
								description="Escolha um nome e como ele se repete: dias da semana, a cada N dias, dias do mês, uma data ou todo ano."
								action={
									<Button
										icon="plus"
										label="Criar hábito"
										onPress={() => router.push("/habit/new")}
									/>
								}
							/>
						);
					}
					return (
						<View className="gap-8">
							<HabitList
								habits={active}
								today={today}
								empty="Todos os hábitos estão arquivados."
							/>
							{past.length > 0 ? (
								<View className="gap-3">
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ expanded: showPast }}
										accessibilityHint="Mostra ou esconde as datas únicas que já passaram"
										onPress={() => setShowPast((open) => !open)}
										className="min-h-touch flex-row items-center justify-between rounded-xl border border-border px-4"
									>
										<Text className="text-sm font-bold tracking-widest text-muted uppercase">
											Passados ({past.length})
										</Text>
										<MaterialCommunityIcons
											name={showPast ? "chevron-up" : "chevron-down"}
											size={24}
											color={colors.muted}
										/>
									</Pressable>
									{showPast ? <HabitList habits={past} today={today} /> : null}
								</View>
							) : null}
							{archived.length > 0 ? (
								<View className="gap-3">
									<Text
										accessibilityRole="header"
										className="text-sm font-bold tracking-widest text-muted uppercase"
									>
										Arquivados
									</Text>
									<HabitList habits={archived} today={today} />
								</View>
							) : null}
						</View>
					);
				}}
			</QueryState>
		</Screen>
	);
}

function HabitList({
	habits,
	today,
	empty,
}: {
	habits: Habit[];
	today: string;
	empty?: string;
}) {
	const router = useRouter();
	if (habits.length === 0) {
		return empty ? <Text className="text-muted">{empty}</Text> : null;
	}
	return (
		<View className="gap-2">
			{habits.map((habit) => (
				<Pressable
					key={habit.id}
					accessibilityRole="button"
					accessibilityLabel={`${habit.name}, ${isSupportedSchedule(habit.schedule) ? scheduleText(habit, today) : "incompatível com esta versão"}`}
					accessibilityHint="Abre para editar ou arquivar"
					onPress={() =>
						router.push({ pathname: "/habit/[id]", params: { id: habit.id } })
					}
					className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 active:bg-border"
				>
					<View className="flex-1 gap-1">
						<Text
							className={`text-base font-semibold ${habit.archived_at === null ? "text-foreground" : "text-muted"}`}
						>
							{habit.name}
						</Text>
						{isSupportedSchedule(habit.schedule) ? (
							<Text className="text-sm text-muted">
								{scheduleText(habit, today)}
							</Text>
						) : (
							<View className="flex-row items-center gap-2">
								<Text className="rounded-sm border border-danger px-1 text-xs font-semibold text-danger">
									Incompatível
								</Text>
								<Text className="text-xs text-muted">
									Atualize o app para ver a repetição.
								</Text>
							</View>
						)}
					</View>
					<MaterialCommunityIcons
						name="chevron-right"
						size={24}
						color={colors.muted}
					/>
				</Pressable>
			))}
		</View>
	);
}
