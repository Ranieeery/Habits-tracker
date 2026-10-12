import type { OverviewStats, PeriodProgress } from "@habits/core";
import { formatPercent } from "@/lib/format.ts";

function days(count: number) {
	return count === 1 ? "dia" : "dias";
}

function Stat({
	label,
	value,
	unit,
	description,
}: {
	label: string;
	value: string;
	unit?: string;
	/** Read instead of `value` + `unit` when they need words. */
	description?: string;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-sm text-night-muted">{label}</dt>
			<dd className="font-display text-3xl leading-none font-bold text-night-foreground tabular-nums">
				<span aria-hidden={description ? true : undefined}>{value}</span>
				{unit && (
					<span className="ml-1 font-sans text-sm font-medium text-night-muted">
						{unit}
					</span>
				)}
				{description && <span className="sr-only">{description}</span>}
			</dd>
		</div>
	);
}

function percent(progress: PeriodProgress) {
	return progress.possible === 0
		? { value: "—", description: "nenhum hábito previsto" }
		: { value: formatPercent(progress.ratio) };
}

/**
 * The numbers above the heatmap, all from core's `overviewStats`: the
 * current and best runs of strong days (80% or more) and this week's and
 * this month's share of habits done. `stats` is null while loading.
 */
export function OverviewStrip({
	stats,
	year,
}: {
	stats: OverviewStats | null;
	year: number;
}) {
	if (!stats) {
		return (
			<div
				aria-hidden="true"
				className="flex flex-wrap gap-x-10 gap-y-4"
				data-overview-loading=""
			>
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="flex flex-col gap-2">
						<div className="h-4 w-24 rounded-sm bg-night-surface-raised" />
						<div className="h-7 w-16 rounded-sm bg-night-surface-raised" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<dl
				aria-label="Resumo"
				className="grid grid-cols-2 gap-x-10 gap-y-4 sm:flex sm:flex-wrap"
			>
				<Stat
					label="Sequência atual"
					value={String(stats.current_streak)}
					unit={days(stats.current_streak)}
				/>
				<Stat
					label={`Melhor em ${year}`}
					value={String(stats.longest_streak)}
					unit={days(stats.longest_streak)}
				/>
				<Stat label="Esta semana" {...percent(stats.week)} />
				<Stat label="Este mês" {...percent(stats.month)} />
			</dl>
			<p className="text-xs text-night-subtle">
				Sequência: dias seguidos com 80% ou mais dos hábitos feitos.
			</p>
		</div>
	);
}
