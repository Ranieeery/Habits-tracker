import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import { completionRatio, isCalendarDate } from "@habits/core";
import { colors } from "@habits/design-tokens";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { isSettled, useDay, useToggleCompletion } from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import {
	formatFullDate,
	formatLongDate,
	formatPercent,
	formatShortDate,
} from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { CheckboxBox } from "@/ui/checkbox.tsx";
import { ProgressBar } from "@/ui/progress-bar.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { useToast } from "@/ui/toast.tsx";

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
	return <DayView date={date} today={today} />;
}

/**
 * The habits possible on `date` and their completion. Only today can be
 * edited, like the legacy app; other days are read-only.
 */
function DayView({ date, today }: { date: CalendarDate; today: CalendarDate }) {
	const router = useRouter();
	const toast = useToast();
	const day = useDay(date);
	const toggle = useToggleCompletion(date, (error) => {
		if (!isUnauthorized(error)) {
			toast("error", "Não foi possível salvar", errorMessage(error));
		}
	});
	const editable = date === today;
	useHideSplashWhen(isSettled(day));

	const [weekday = "", ...rest] = formatLongDate(date).split(", ");

	return (
		<Screen
			edges={[]}
			onRefresh={() => void day.refetch()}
			refreshing={day.isRefetching}
		>
			<Stack.Screen
				options={{ title: editable ? "Hoje" : formatShortDate(date) }}
			/>
			<View className="gap-1">
				<Text className="font-semibold text-muted capitalize">
					{editable ? "Hoje" : rest.join(", ")}
				</Text>
				<Text
					accessibilityRole="header"
					accessibilityLabel={formatFullDate(date)}
					className="text-3xl font-extrabold text-foreground capitalize"
				>
					{weekday} <Text className="text-muted">{formatShortDate(date)}</Text>
				</Text>
			</View>

			<QueryState query={day} loadingLabel="Carregando o dia…">
				{(data) =>
					data.possible_habits.length === 0 ? (
						<EmptyState
							title="Nenhum hábito para este dia"
							description="Hábitos aparecem nos dias da semana escolhidos para eles."
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
							onToggle={(habitId, completed) => {
								void Haptics.selectionAsync();
								toggle.mutate({ habitId, completed });
							}}
						/>
					)
				}
			</QueryState>
		</Screen>
	);
}

function DayContent({
	possible,
	completedIds,
	editable,
	onToggle,
}: {
	possible: Habit[];
	completedIds: Set<string>;
	editable: boolean;
	onToggle: (habitId: string, completed: boolean) => void;
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
				<Text className="text-sm text-muted">{summary}</Text>
			</View>

			{!editable ? (
				<View className="flex-row items-center gap-2">
					<MaterialCommunityIcons
						name="lock-outline"
						size={16}
						color={colors.muted}
					/>
					<Text className="flex-1 text-sm text-muted">
						Somente leitura: só é possível marcar os hábitos de hoje.
					</Text>
				</View>
			) : null}

			<View className="gap-2">
				{possible.map((habit) => {
					const checked = completedIds.has(habit.id);
					return (
						<Pressable
							key={habit.id}
							accessibilityRole="checkbox"
							accessibilityLabel={habit.name}
							accessibilityState={{ checked, disabled: !editable }}
							disabled={!editable}
							onPress={() => onToggle(habit.id, !checked)}
							className="min-h-14 flex-row items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 active:bg-border"
						>
							<CheckboxBox checked={checked} />
							<Text
								className={`flex-1 text-lg font-semibold ${checked ? "text-muted line-through" : "text-foreground"}`}
							>
								{habit.name}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</>
	);
}
