// pt-BR wording of the overview numbers (the numbers themselves come from
// core's `overviewStats`, the same as on the web). On the phone they sit in
// one row of four, so the visible labels are short; screen readers get the
// full sentence.
import type { OverviewStats, PeriodProgress } from "@habits/core";
import { formatPercent } from "@/lib/format.ts";

export interface OverviewItem {
	/** Short visible label ("Sequência"). */
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

function percent(
	label: string,
	spoken: string,
	progress: PeriodProgress
): OverviewItem {
	if (progress.possible === 0) {
		return {
			label,
			value: "—",
			accessibilityLabel: `${spoken}: nenhum hábito previsto`,
		};
	}
	const value = formatPercent(progress.ratio);
	return {
		label,
		value,
		accessibilityLabel: `${spoken}: ${value}, ${progress.completed} de ${progress.possible} hábitos`,
	};
}

/** The four numbers above the heatmap; only "Melhor em" follows `year`. */
export function overviewItems(
	stats: OverviewStats,
	year: number
): OverviewItem[] {
	const current = stats.current_streak;
	const longest = stats.longest_streak;
	return [
		{
			label: "Sequência",
			value: String(current),
			unit: days(current),
			accessibilityLabel: `Sequência atual: ${current} ${current === 1 ? "dia" : "dias seguidos"} com 80% ou mais dos hábitos feitos`,
		},
		{
			label: `Melhor em ${year}`,
			value: String(longest),
			unit: days(longest),
			accessibilityLabel: `Melhor sequência em ${year}: ${longest} ${days(longest)}`,
		},
		percent("Semana", "Esta semana", stats.week),
		percent("Mês", "Este mês", stats.month),
	];
}
