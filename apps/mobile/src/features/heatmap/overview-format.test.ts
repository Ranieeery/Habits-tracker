import { describe, expect, it } from "vitest";
import { overviewItems } from "./overview-format.ts";

const stats = {
	current_streak: 1,
	longest_streak: 12,
	week: { completed: 9, possible: 12, ratio: 0.75 },
	month: { completed: 0, possible: 0, ratio: 0 },
};

describe("overviewItems", () => {
	it("uses short visible labels and full sentences for screen readers", () => {
		expect(overviewItems(stats, 2026)).toEqual([
			{
				label: "Sequência",
				value: "1",
				unit: "dia",
				accessibilityLabel:
					"Sequência atual: 1 dia com 80% ou mais dos hábitos feitos",
			},
			{
				label: "Melhor em 2026",
				value: "12",
				unit: "dias",
				accessibilityLabel: "Melhor sequência em 2026: 12 dias",
			},
			{
				label: "Semana",
				value: "75%",
				accessibilityLabel: "Esta semana: 75%, 9 de 12 hábitos",
			},
			{
				label: "Mês",
				value: "—",
				accessibilityLabel: "Este mês: nenhum hábito previsto",
			},
		]);
	});

	it("says the run in days in a row when there is more than one", () => {
		expect(
			overviewItems({ ...stats, current_streak: 3 }, 2026)[0]!
				.accessibilityLabel
		).toBe(
			"Sequência atual: 3 dias seguidos com 80% ou mais dos hábitos feitos"
		);
	});

	it("names the shown year only in the best run", () => {
		const labels = overviewItems(stats, 2025).map((item) => item.label);
		expect(labels).toEqual(["Sequência", "Melhor em 2025", "Semana", "Mês"]);
	});
});
