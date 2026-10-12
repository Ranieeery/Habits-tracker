// pt-BR wording of the overview numbers (the numbers themselves come from
// core's `overviewStats`, the same as on the web).
import type { OverviewStats, PeriodProgress } from "@habits/core";
import { formatPercent } from "@/lib/format.ts";

export interface OverviewItem {
	label: string;
	/** Big number in the display face. */
	value: string;
	/** Small word after the number ("dias"). */
	unit?: string;
	/** What a screen reader says for the item. */
	accessibilityLabel: string;
}

function days(count: number): string {
	return count === 1 ? "dia" : "dias";
}

function streak(label: string, count: number): OverviewItem {
	return {
		label,
		value: String(count),
		unit: days(count),
		accessibilityLabel: `${label}: ${count} ${days(count)}`,
	};
}

function percent(label: string, progress: PeriodProgress): OverviewItem {
	if (progress.possible === 0) {
		return {
			label,
			value: "—",
			accessibilityLabel: `${label}: nenhum hábito previsto`,
		};
	}
	const value = formatPercent(progress.ratio);
	return {
		label,
		value,
		accessibilityLabel: `${label}: ${value}, ${progress.completed} de ${progress.possible} hábitos`,
	};
}

/** The four numbers above the heatmap; only "Melhor em" follows `year`. */
export function overviewItems(
	stats: OverviewStats,
	year: number
): OverviewItem[] {
	return [
		streak("Sequência atual", stats.current_streak),
		streak(`Melhor em ${year}`, stats.longest_streak),
		percent("Esta semana", stats.week),
		percent("Este mês", stats.month),
	];
}
