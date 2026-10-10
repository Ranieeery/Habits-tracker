import { buildYearGrid, parseCalendarDate } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { habitsQuery, summaryQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";

export function HeatmapPage() {
	const { api } = useServices();
	const today = useToday();
	const year = parseCalendarDate(today).year;
	const summary = useQuery(summaryQuery(api, year));
	const habits = useQuery(habitsQuery(api));

	const grid = useMemo(
		() => buildYearGrid({ year, today, summary: summary.data }),
		[year, today, summary.data]
	);

	return (
		<section aria-labelledby="heatmap-title" className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 id="heatmap-title" className="text-3xl font-extrabold">
						{year}
					</h1>
					<p className="text-sm text-muted">
						Cada quadrado é um dia. Toque para ver os hábitos.
					</p>
				</div>
				<HeatmapLegend />
			</header>

			{summary.isPending ? (
				<Skeleton className="h-80 w-full rounded-xl md:h-56" />
			) : summary.isError ? (
				<ErrorState error={summary.error} onRetry={() => summary.refetch()} />
			) : (
				<HeatmapGrid grid={grid} />
			)}

			{habits.data?.length === 0 && (
				<EmptyState
					title="Nenhum hábito ainda"
					description="Crie seu primeiro hábito para começar a preencher o ano."
					action={
						<Link to="/habits" className={buttonVariants()}>
							Criar hábito
						</Link>
					}
				/>
			)}
		</section>
	);
}
