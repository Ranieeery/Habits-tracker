import { buildYearGrid, type GridCell } from "@habits/core";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInRouter, TODAY } from "@/test/harness.tsx";
import { HeatmapCell } from "./heatmap-cell.tsx";
import { cellLabel } from "./heatmap-utils.ts";

function cellOf(date: string, completed: number, possible: number): GridCell {
	const grid = buildYearGrid({
		year: 2026,
		today: TODAY,
		summary: [{ date, completed, possible }],
	});
	const cell = grid.weeks
		.flatMap((week) => week.days)
		.find((c) => c.date === date);
	if (!cell) throw new Error(`No cell for ${date}`);
	return cell;
}

describe("HeatmapCell", () => {
	it.each([
		[0, 4, 0],
		[1, 10, 1],
		[1, 4, 2],
		[2, 4, 3],
		[3, 4, 4],
		[4, 4, 5],
	])(
		"renders %i of %i habits with level %i classes",
		async (completed, possible, level) => {
			await renderInRouter(
				<HeatmapCell cell={cellOf("2026-10-01", completed, possible)} />
			);
			const link = screen.getByRole("link");
			expect(link).toHaveAttribute("data-level", String(level));
			expect(link).toHaveClass(
				`bg-heatmap-${level}`,
				`border-heatmap-${level}-border`
			);
			expect(link).toHaveAttribute("href", "/day/2026-10-01");
		}
	);

	it("describes the date and the ratio for screen readers", async () => {
		await renderInRouter(<HeatmapCell cell={cellOf("2026-10-01", 3, 5)} />);
		expect(
			screen.getByRole("link", {
				name: "1 de outubro de 2026: 3 de 5 hábitos concluídos (60%)",
			})
		).toBeInTheDocument();
	});

	it("says when nothing was scheduled", () => {
		expect(cellLabel(cellOf("2026-10-02", 0, 0))).toBe(
			"2 de outubro de 2026: nenhum hábito previsto"
		);
	});

	it("marks today", async () => {
		await renderInRouter(<HeatmapCell cell={cellOf(TODAY, 1, 2)} />);
		const link = screen.getByRole("link");
		expect(link).toHaveAttribute("aria-current", "date");
		expect(link.getAttribute("aria-label")).toContain("(hoje)");
	});

	it("renders future days as inert placeholders", async () => {
		await renderInRouter(<HeatmapCell cell={cellOf("2026-10-20", 0, 0)} />);
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(
			document.querySelector('[data-relation="future"]')
		).toBeInTheDocument();
	});

	it("renders padding days of other years as empty space", async () => {
		const padding = buildYearGrid({ year: 2026, today: TODAY }).weeks[0]!
			.days[0]!;
		expect(padding.in_year).toBe(false);
		await renderInRouter(<HeatmapCell cell={padding} />);
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});
});
