import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Habit } from "@habits/contracts";
import { colors } from "@habits/design-tokens";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { isSettled, useHabits } from "@/data/hooks.ts";
import { formatWeekdays } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";

function scheduleText(habit: Habit): string {
	switch (habit.schedule.type) {
		case "weekdays":
			return formatWeekdays(habit.schedule.days);
	}
}

export function HabitsScreen() {
	const router = useRouter();
	const habits = useHabits();
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
					const active = list.filter((habit) => habit.archived_at === null);
					const archived = list.filter((habit) => habit.archived_at !== null);
					if (list.length === 0) {
						return (
							<EmptyState
								title="Nenhum hábito ainda"
								description="Escolha um nome e os dias da semana em que ele se repete."
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
								empty="Todos os hábitos estão arquivados."
							/>
							{archived.length > 0 ? (
								<View className="gap-3">
									<Text
										accessibilityRole="header"
										className="text-sm font-bold tracking-widest text-muted uppercase"
									>
										Arquivados
									</Text>
									<HabitList habits={archived} />
								</View>
							) : null}
						</View>
					);
				}}
			</QueryState>
		</Screen>
	);
}

function HabitList({ habits, empty }: { habits: Habit[]; empty?: string }) {
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
					accessibilityLabel={`${habit.name}, ${scheduleText(habit)}`}
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
						<Text className="text-sm text-muted">{scheduleText(habit)}</Text>
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
