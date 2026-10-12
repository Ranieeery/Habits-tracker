import { buildYearGrid, clampYear, heatmapYearRange } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { habitsQuery, summaryQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { HeatmapLegend } from "./heatmap-legend.tsx";

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

	const grid = useMemo(
		() => buildYearGrid({ year, today, summary: summary.data }),
		[year, today, summary.data]
	);

	return (
		<section aria-labelledby="heatmap-title" className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<div className="flex items-center gap-1">
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
							className="text-3xl font-extrabold tabular-nums"
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
