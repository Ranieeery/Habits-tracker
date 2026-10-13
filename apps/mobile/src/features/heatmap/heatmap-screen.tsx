import type { GridCell } from "@habits/core";
import {
	buildYearGrid,
	clampYear,
	heatmapYearRange,
	overviewNeedsPreviousYear,
	overviewStats,
	trendNeedsPreviousYear,
} from "@habits/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
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
import { Backdrop } from "@/ui/backdrop.tsx";
import { IconButton } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { Screen, type ScreenScroll } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";
import { HabitFilter } from "./habit-filter.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";
import {
	HeatmapEmpty,
	HeatmapError,
	HeatmapSkeleton,
} from "./heatmap-states.tsx";
import { HighlightsSection } from "./highlights-section.tsx";
import { OverviewStrip } from "./overview-strip.tsx";
import { PerHabitSection } from "./per-habit-section.tsx";
import { TrendSection } from "./trend-section.tsx";

/**
 * The "Histórico" tab (DESIGN.md "Mobile"). The heatmap stays the hero at
 * the top (header, date, overview, an optional habit filter, the year and
 * its grid); below it, quieter sections each answer one question (2.7.0):
 * "Tendência" (getting better?), "Destaques" (what stands out this year?)
 * and "Por hábito" (how is each one doing? a tap filters the map). The
 * filter is memory only and resets when the tab loses focus. Tapping a past
 * day opens the day screen; today opens the Hoje tab.
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
	// null: every habit.
	const [habitId, setHabitId] = useState<string | null>(null);
	const filter = habitId ?? undefined;
	useFocusEffect(useCallback(() => () => setHabitId(null), []));

	const summary = useYearSummary(year, { habitId: filter });
	// The overview and the trend are about today: today's year always, and
	// last year too when core says they reach into it (same as the web).
	const current = useYearSummary(range.last, { habitId: filter });
	const needsPrevious =
		trendNeedsPreviousYear(today) ||
		(current.data !== undefined &&
			overviewNeedsPreviousYear(current.data, today));
	const previous = useYearSummary(range.last - 1, {
		habitId: filter,
		enabled: needsPrevious,
	});
	const { refresh, refreshing } = useRefreshAll();
	useHideSplashWhen(isSettled(summary));

	const grid = useMemo(
		() => summary.data && buildYearGrid({ year, today, summary: summary.data }),
		[year, today, summary.data]
	);
	const recent = useMemo(
		() => [...(previous.data ?? []), ...(current.data ?? [])],
		[previous.data, current.data]
	);
	const stats = useMemo(() => {
		if (!current.data || !summary.data) return null;
		if (needsPrevious && previous.isPending) return null;
		return overviewStats({
			days: [...recent, ...summary.data],
			today,
			year,
		});
	}, [
		current.data,
		summary.data,
		needsPrevious,
		previous.isPending,
		recent,
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

	// The grid fades in again when the filter changes (150 ms, opacity only):
	// the same grid stays mounted, so its entrance sweep does not replay.
	const reduced = useReducedMotion();
	const gridOpacity = useSharedValue(1);
	const firstFilter = useRef(true);
	useEffect(() => {
		if (firstFilter.current) {
			firstFilter.current = false;
			return;
		}
		if (reduced) return;
		gridOpacity.set(0.3);
		gridOpacity.set(withTiming(1, { duration: 150 }));
	}, [habitId, reduced, gridOpacity]);
	const gridFade = useAnimatedStyle(() => ({ opacity: gridOpacity.get() }));

	const scroll = useRef<ScreenScroll>(null);
	const active = (habits.data ?? []).filter(
		(habit) => habit.archived_at === null && habit.deleted_at === null
	);
	const filtered = active.find((habit) => habit.id === habitId);
	const noHabits = habits.data?.length === 0;

	return (
		<Screen
			onRefresh={() => void refresh()}
			refreshing={refreshing}
			background={<Backdrop />}
			scrollRef={scroll}
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
				<HabitFilter habits={active} selected={habitId} onSelect={setHabitId} />
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
					{filtered ? (
						<Text
							numberOfLines={1}
							className="flex-1 text-base text-night-muted"
						>
							{filtered.name}
						</Text>
					) : null}
				</View>

				{summary.isError && !summary.data ? (
					<HeatmapError
						error={summary.error}
						onRetry={() => void summary.refetch()}
					/>
				) : noHabits ? (
					<HeatmapEmpty onCreate={() => router.push("/habit/new")} />
				) : grid ? (
					<Animated.View style={[gridFade, { gap: 12 }]}>
						<HeatmapGrid
							grid={grid}
							filtered={habitId !== null}
							onOpenDay={openDay}
						/>
						<View className="flex-row flex-wrap items-center justify-between gap-2">
							<Text className="flex-1 text-xs text-night-subtle">
								Sequência: dias com 80% ou mais.
							</Text>
							<HeatmapLegend />
						</View>
					</Animated.View>
				) : (
					<HeatmapSkeleton width={width - 32} />
				)}
			</View>

			{noHabits || !current.data ? null : (
				<TrendSection days={recent} today={today} />
			)}
			{noHabits || !summary.data ? null : (
				<HighlightsSection
					days={summary.data}
					today={today}
					year={year}
					currentYear={year === range.last}
				/>
			)}
			{noHabits ? null : (
				<PerHabitSection
					habits={active}
					today={today}
					onSelect={(id) => {
						setHabitId(id);
						scroll.current?.scrollTo({ y: 0, animated: !reduced });
					}}
				/>
			)}
		</Screen>
	);
}
