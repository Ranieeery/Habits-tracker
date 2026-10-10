import { buildYearGrid } from "@habits/core";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderInRouter, TODAY } from "@/test/harness.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { scrollLeftFor } from "./heatmap-utils.ts";

const grid = buildYearGrid({
	year: 2026,
	today: TODAY,
	summary: [
		{ date: "2026-10-05", completed: 1, possible: 1 },
		{ date: "2026-10-06", completed: 0, possible: 2 },
	],
});

describe("HeatmapGrid", () => {
	it("renders one column per week with seven days each", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const columns = document.querySelectorAll("[data-week-index]");
		expect(columns).toHaveLength(53);
		// Sunday-first: the first column starts on Sunday Dec 28, 2025 (padding).
		expect(columns[0]!.children).toHaveLength(8); // month label + 7 days
	});

	it("flags the current week and today inside it", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const current = document.querySelectorAll("[data-current-week]");
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveAttribute(
			"data-week-index",
			String(grid.today_week_index)
		);
		const today = within(current[0] as HTMLElement).getByRole("link", {
			current: "date",
		});
		expect(today).toHaveAttribute("href", `/day/${TODAY}`);
	});

	it("scrolls the current week into view on mount", async () => {
		vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
			function (this: HTMLElement) {
				return this.hasAttribute("data-current-week") ? 2000 : 0;
			}
		);
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(48);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
		const setScroll = vi.spyOn(Element.prototype, "scrollLeft", "set");

		await renderInRouter(<HeatmapGrid grid={grid} />);

		expect(setScroll).toHaveBeenCalledWith(
			scrollLeftFor({ offsetLeft: 2000, offsetWidth: 48 }, 400)
		);
		expect(scrollLeftFor({ offsetLeft: 2000, offsetWidth: 48 }, 400)).toBe(
			1728
		);
	});

	it("labels the months where they start and names the region", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		expect(
			screen.getByRole("region", { name: "Histórico de 2026" })
		).toBeInTheDocument();
		for (const month of ["jan", "fev", "out", "dez"]) {
			expect(screen.getByText(month)).toBeInTheDocument();
		}
	});

	it("does not scroll past the start for early weeks", () => {
		expect(scrollLeftFor({ offsetLeft: 50, offsetWidth: 48 }, 400)).toBe(0);
	});
});
