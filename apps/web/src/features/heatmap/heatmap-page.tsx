import {
	buildYearGrid,
	clampYear,
	heatmapYearRange,
	overviewNeedsPreviousYear,
	overviewStats,
	PREVIEW_DAYS,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { habitsQuery, summaryQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";
import {
	HeatmapEmpty,
	HeatmapError,
	HeatmapSkeleton,
} from "./heatmap-states.tsx";
import { OverviewStrip } from "./overview-strip.tsx";
import { TodayPanel } from "./today-panel.tsx";

/**
 * The home screen: the year heatmap (the hero), the overview numbers above
 * it and today's habits beside it (below on narrow screens).
 */
export function HeatmapPage() {
	const { api } = useServices();
	const today = useToday();
	const habits = useQuery(habitsQuery(api));
	const range = heatmapYearRange(habits.data ?? [], today);
	// null: the current year, which follows "today" across New Year.
	const [chosen, setChosen] = useState<number | null>(null);
	const year = chosen === null ? range.last : clampYear(chosen, range);
	const goTo = (next: number) => setChosen(next >= range.last ? null : next);
	const summary = useQuery(summaryQuery(api, year));

	// The overview is about today: today's year always, and last year too
	// when this week or the current streak reaches into it (same queries
	// the year arrows use, so nothing is fetched twice).
	const current = useQuery(summaryQuery(api, range.last));
	const needsPrevious =
		current.data !== undefined &&
		overviewNeedsPreviousYear(current.data, today);
	const previous = useQuery({
		...summaryQuery(api, range.last - 1),
		enabled: needsPrevious,
	});

	const grid = useMemo(
		// The current year also shows the next PREVIEW_DAYS (2.14.0): read-only
		// cells without counts; core ignores it for other years.
		() =>
			buildYearGrid({
				year,
				today,
				summary: summary.data,
				previewDays: PREVIEW_DAYS,
			}),
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

	const noHabits = habits.data?.length === 0;

	return (
		<section aria-labelledby="heatmap-title" className="flex flex-col gap-8">
			<header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
				<div className="-ml-3 flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Ano anterior"
						disabled={year <= range.first}
						onClick={() => goTo(year - 1)}
					>
						<ChevronLeftIcon aria-hidden="true" />
					</Button>
					<h1
						id="heatmap-title"
						aria-live="polite"
						className="font-display text-5xl font-bold tracking-tight tabular-nums"
					>
						{year}
					</h1>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Próximo ano"
						disabled={year >= range.last}
						onClick={() => goTo(year + 1)}
					>
						<ChevronRightIcon aria-hidden="true" />
					</Button>
				</div>
				{!noHabits && <OverviewStrip stats={stats} year={year} />}
			</header>

			{/* minmax(0, …) on phones too: a long description line in the panel
			    (truncated) must not widen the column past the screen. */}
			<div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
				<div className="flex min-w-0 flex-col gap-3">
					{summary.isPending ? (
						<HeatmapSkeleton />
					) : summary.isError ? (
						<HeatmapError
							error={summary.error}
							onRetry={() => summary.refetch()}
						/>
					) : noHabits ? (
						<HeatmapEmpty />
					) : (
						<>
							<HeatmapGrid key={year} grid={grid} />
							<div className="flex flex-wrap items-center justify-between gap-3">
								<p className="text-sm text-night-muted">
									Cada quadrado é um dia. Toque ou clique para ver os hábitos.
								</p>
								<HeatmapLegend />
							</div>
						</>
					)}
				</div>
				<TodayPanel today={today} />
			</div>
		</section>
	);
}
