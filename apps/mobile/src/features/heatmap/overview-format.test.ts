import { describe, expect, it } from "vitest";
import { overviewItems } from "./overview-format.ts";

const stats = {
	current_streak: 1,
	longest_streak: 12,
	week: { completed: 9, possible: 12, ratio: 0.75 },
	month: { completed: 0, possible: 0, ratio: 0 },
};

describe("overviewItems", () => {
	it("words the four numbers like the web", () => {
		expect(overviewItems(stats, 2026)).toEqual([
			{
				label: "Sequência atual",
				value: "1",
				unit: "dia",
				accessibilityLabel: "Sequência atual: 1 dia",
			},
			{
				label: "Melhor em 2026",
				value: "12",
				unit: "dias",
				accessibilityLabel: "Melhor em 2026: 12 dias",
			},
			{
				label: "Esta semana",
				value: "75%",
				accessibilityLabel: "Esta semana: 75%, 9 de 12 hábitos",
			},
			{
				label: "Este mês",
				value: "—",
				accessibilityLabel: "Este mês: nenhum hábito previsto",
			},
		]);
	});

	it("names the shown year only in the best run", () => {
		const labels = overviewItems(stats, 2025).map((item) => item.label);
		expect(labels).toEqual([
			"Sequência atual",
			"Melhor em 2025",
			"Esta semana",
			"Este mês",
		]);
	});
});
