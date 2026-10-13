// pt-BR sentences for the history's quieter sections (2.7.0). The numbers
// come from core's insights; this only words them, briefly.
import type { TrendChange, YearHighlights } from "@habits/core";
import { MONTH_NAMES } from "@habits/core";
import { capitalizeFirst, formatPercent, weekdayName } from "@/lib/format.ts";

/** "Últimas 4 semanas: 78%, 6 pontos acima das 4 anteriores." */
export function trendSentence(change: TrendChange): string | null {
	if (change.recent.possible === 0) return null;
	const recent = `Últimas 4 semanas: ${formatPercent(change.recent.ratio)}`;
	if (change.delta === null) return `${recent}.`;
	if (change.delta === 0) return `${recent}, igual às 4 anteriores.`;
	const points = Math.abs(change.delta);
	const unit = points === 1 ? "ponto" : "pontos";
	const direction = change.delta > 0 ? "acima" : "abaixo";
	return `${recent}, ${points} ${unit} ${direction} das 4 anteriores.`;
}

/** At most three short highlights, only those the data supports. */
export function highlightSentences(
	highlights: YearHighlights,
	{ currentYear }: { currentYear: boolean }
): string[] {
	const lines: string[] = [];
	if (highlights.bestWeekday) {
		const name = weekdayName(highlights.bestWeekday.weekday);
		const verb = currentYear ? "é" : "foi";
		lines.push(
			`Seu melhor dia ${verb} ${name} (${formatPercent(highlights.bestWeekday.ratio)}).`
		);
	}
	if (highlights.bestMonth) {
		const month = capitalizeFirst(
			MONTH_NAMES[highlights.bestMonth.month - 1] ?? ""
		);
		lines.push(
			currentYear
				? `${month} é seu melhor mês até agora.`
				: `${month} foi seu melhor mês.`
		);
	}
	if (highlights.perfectDays > 0) {
		const days = highlights.perfectDays;
		lines.push(`${days} ${days === 1 ? "dia" : "dias"} com tudo feito.`);
	}
	return lines;
}
