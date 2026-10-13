import type { GridCell } from "@habits/core";
import {
	buildYearGrid,
	clampYear,
	heatmapYearRange,
	overviewNeedsPreviousYear,
	overviewStats,
} from "@habits/core";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
	isSettled,
	useHabits,
	useRefreshAll,
	useYearSummary,
} from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import { TimezoneBanner } from "@/features/settings/timezone-banner.tsx";
import { TabHeader } from "@/features/shell/tab-header.tsx";
import { capitalizeFirst, formatLongDate } from "@/lib/format.ts";
import { IconButton } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { Backdrop } from "@/ui/backdrop.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";
import {
	HeatmapEmpty,
	HeatmapError,
	HeatmapSkeleton,
} from "./heatmap-states.tsx";
import { OverviewStrip } from "./overview-strip.tsx";

/**
 * The "Histórico" tab (the heatmap, DESIGN.md "Mobile"): mark, sync state
 * and gear, the date, the overview numbers, the year and its grid. Today's
 * habits live in the "Hoje" tab since 2.6.0; tapping a past day still opens
 * the day screen, and today opens the Hoje tab.
 */
export function HeatmapScreen() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const today = useToday();
	const habits = useHabits();
	const range = heatmapYearRange(habits.data ?? [], today);
	// null: the current year, which follows "today" across New Year.
	const [chosen, setChosen] = useState<number | null>(null);
	const year = chosen === null ? range.last : clampYear(chosen, range);
	const goTo = (next: number) => setChosen(next >= range.last ? null : next);
	const summary = useYearSummary(year);
	// The overview is about today: today's year always, and last year too
	// when core says the numbers reach into it (same as the web).
	const current = useYearSummary(range.last);
	const needsPrevious =
		current.data !== undefined &&
		overviewNeedsPreviousYear(current.data, today);
	const previous = useYearSummary(range.last - 1, { enabled: needsPrevious });
	const { refresh, refreshing } = useRefreshAll();
	useHideSplashWhen(isSettled(summary));

	const grid = useMemo(
		() => summary.data && buildYearGrid({ year, today, summary: summary.data }),
		[year, today, summary.data]
	);
	const stats = useMemo(() => {
		if (!current.data || !summary.data) return null;
		if (needsPrevious && previous.isPending) return null;
		return overviewStats({
			days: [...(previous.data ?? []), ...current.data, ...summary.data],
			today,
			year,
		});
	}, [
		current.data,
		summary.data,
		needsPrevious,
		previous.isPending,
		previous.data,
		today,
		year,
	]);

	const openDay = useCallback(
		(cell: GridCell) =>
			cell.relation === "today"
				? router.navigate("/")
				: router.push({
						pathname: "/day/[date]",
						params: { date: cell.date },
					}),
		[router]
	);

	const noHabits = habits.data?.length === 0;

	return (
		<Screen
			onRefresh={() => void refresh()}
			refreshing={refreshing}
			background={<Backdrop />}
		>
			<View className="gap-1">
				<TabHeader />
				<Text className="text-sm text-night-muted">
					{capitalizeFirst(formatLongDate(today))}
				</Text>
			</View>

			<TimezoneBanner />

			{noHabits ? null : <OverviewStrip stats={stats} year={year} />}

			<View className="gap-3">
				<View className="-ml-3 flex-row items-center">
					<IconButton
						icon="chevron-left"
						label="Ano anterior"
						disabled={year <= range.first}
						onPress={() => goTo(year - 1)}
					/>
					<DisplayText
						accessibilityRole="header"
						accessibilityLiveRegion="polite"
						className="text-3xl tracking-tight text-night-foreground"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{year}
					</DisplayText>
					<IconButton
						icon="chevron-right"
						label="Próximo ano"
						disabled={year >= range.last}
						onPress={() => goTo(year + 1)}
					/>
				</View>

				{summary.isError && !summary.data ? (
					<HeatmapError
						error={summary.error}
						onRetry={() => void summary.refetch()}
					/>
				) : noHabits ? (
					<HeatmapEmpty onCreate={() => router.push("/habit/new")} />
				) : grid ? (
					<>
						<HeatmapGrid grid={grid} onOpenDay={openDay} />
						<View className="flex-row flex-wrap items-center justify-between gap-2">
							<Text className="flex-1 text-xs text-night-subtle">
								Sequência: dias com 80% ou mais.
							</Text>
							<HeatmapLegend />
						</View>
					</>
				) : (
					<HeatmapSkeleton width={width - 32} />
				)}
			</View>
		</Screen>
	);
}
