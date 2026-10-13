import { describe, expect, it } from "vitest";
import { highlightSentences, trendSentence } from "./insights-format.ts";

const progress = (ratio: number, possible = 10) => ({
	completed: Math.round(ratio * possible),
	possible,
	ratio,
});

describe("trendSentence", () => {
	it("says the last 4 weeks and how they compare", () => {
		expect(
			trendSentence({
				recent: progress(0.78),
				previous: progress(0.72),
				delta: 6,
			})
		).toBe("Últimas 4 semanas: 78%, 6 pontos acima das 4 anteriores.");
		expect(
			trendSentence({
				recent: progress(0.5),
				previous: progress(0.51),
				delta: -1,
			})
		).toBe("Últimas 4 semanas: 50%, 1 ponto abaixo das 4 anteriores.");
		expect(
			trendSentence({
				recent: progress(0.5),
				previous: progress(0.5),
				delta: 0,
			})
		).toBe("Últimas 4 semanas: 50%, igual às 4 anteriores.");
	});

	it("skips the comparison without earlier weeks, and says nothing without data", () => {
		expect(
			trendSentence({ recent: progress(1), previous: null, delta: null })
		).toBe("Últimas 4 semanas: 100%.");
		expect(
			trendSentence({ recent: progress(0, 0), previous: null, delta: null })
		).toBeNull();
	});
});

describe("highlightSentences", () => {
	it("words the year's best weekday, month and perfect days", () => {
		expect(
			highlightSentences(
				{
					bestWeekday: { weekday: 3, ratio: 0.86 },
					bestMonth: { month: 10, ratio: 0.9 },
					perfectDays: 42,
				},
				{ currentYear: true }
			)
		).toEqual([
			"Seu melhor dia é quarta-feira (86%).",
			"Outubro é seu melhor mês até agora.",
			"42 dias com tudo feito.",
		]);
	});

	it("uses the past for a past year and drops what is missing", () => {
		expect(
			highlightSentences(
				{
					bestWeekday: null,
					bestMonth: { month: 3, ratio: 1 },
					perfectDays: 1,
				},
				{ currentYear: false }
			)
		).toEqual(["Março foi seu melhor mês.", "1 dia com tudo feito."]);
		expect(
			highlightSentences(
				{ bestWeekday: null, bestMonth: null, perfectDays: 0 },
				{ currentYear: true }
			)
		).toEqual([]);
	});
});
