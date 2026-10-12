import { buildYearGrid, clampYear, heatmapYearRange } from "@habits/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
	isSettled,
	useHabits,
	usePrefetchDay,
	useRefreshAll,
	useYearSummary,
} from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import { TimezoneBanner } from "@/features/settings/timezone-banner.tsx";
import { SyncIndicator } from "@/features/sync/sync-indicator.tsx";
import { formatLongDate } from "@/lib/format.ts";
import { Button, IconButton } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";

export function HeatmapScreen() {
	const router = useRouter();
	const today = useToday();
	const habits = useHabits();
	const range = heatmapYearRange(habits.data ?? [], today);
	// null: the current year, which follows "today" across New Year.
	const [chosen, setChosen] = useState<number | null>(null);
	const year = chosen === null ? range.last : clampYear(chosen, range);
	const goTo = (next: number) => setChosen(next >= range.last ? null : next);
	const summary = useYearSummary(year);
	const { refresh, refreshing } = useRefreshAll();
	// "Hoje" is the most used screen: have it ready before the tap.
	usePrefetchDay(today);
	useHideSplashWhen(isSettled(summary));

	const grid = useMemo(
		() => summary.data && buildYearGrid({ year, today, summary: summary.data }),
		[year, today, summary.data]
	);

	return (
		<Screen onRefresh={() => void refresh()} refreshing={refreshing}>
			<View className="flex-row items-end justify-between gap-4">
				<View className="flex-1 gap-1">
					<View className="flex-row items-center">
						<IconButton
							icon="chevron-left"
							label="Ano anterior"
							disabled={year <= range.first}
							onPress={() => goTo(year - 1)}
						/>
						<Text
							accessibilityRole="header"
							accessibilityLiveRegion="polite"
							className="text-3xl font-extrabold text-foreground"
						>
							{year}
						</Text>
						<IconButton
							icon="chevron-right"
							label="Próximo ano"
							disabled={year >= range.last}
							onPress={() => goTo(year + 1)}
						/>
					</View>
					<Text className="text-sm text-muted capitalize">
						{formatLongDate(today)}
					</Text>
					<SyncIndicator />
				</View>
				<Button
					label="Hoje"
					icon="calendar-today"
					accessibilityHint="Abre os hábitos de hoje"
					onPress={() => router.push("/day/hoje")}
				/>
			</View>

			<TimezoneBanner />

			<QueryState query={summary} loadingLabel="Carregando o ano…">
				{() =>
					grid ? (
						<View className="gap-4">
							<Text className="text-sm text-muted">
								Cada quadrado é um dia. Toque para ver os hábitos.
							</Text>
							<HeatmapGrid
								grid={grid}
								onPressDay={(cell) =>
									router.push({
										pathname: "/day/[date]",
										params: {
											date: cell.relation === "today" ? "hoje" : cell.date,
										},
									})
								}
							/>
							<HeatmapLegend />
						</View>
					) : null
				}
			</QueryState>

			{habits.data?.length === 0 ? (
				<EmptyState
					title="Nenhum hábito ainda"
					description="Crie seu primeiro hábito para começar a preencher o ano."
					action={
						<Button
							variant="outline"
							icon="plus"
							label="Criar hábito"
							onPress={() => router.push("/habit/new")}
						/>
					}
				/>
			) : null}
		</Screen>
	);
}
