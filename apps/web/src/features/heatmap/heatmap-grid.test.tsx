import { buildYearGrid } from "@habits/core";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInRouter, TODAY } from "@/test/harness.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { nextCellIndex, scrollLeftFor } from "./heatmap-utils.ts";

// TODAY = Friday 2026-10-09.
const grid = buildYearGrid({
	year: 2026,
	today: TODAY,
	summary: [
		{ date: "2026-10-05", completed: 1, possible: 1 },
		{ date: "2026-10-06", completed: 0, possible: 2 },
		{ date: TODAY, completed: 1, possible: 2 },
	],
});

const cellLink = (date: string) =>
	document.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
const tooltip = () => document.querySelector("[data-heatmap-tooltip]");

function reduceMotion(reduce: boolean) {
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) =>
			({
				matches: reduce && query.includes("reduce"),
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}) as unknown as MediaQueryList
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HeatmapGrid", () => {
	it("is a named grid with one row per weekday and one cell per week", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const table = screen.getByRole("grid", { name: "Histórico de 2026" });
		const rows = within(table).getAllByRole("row");
		expect(rows).toHaveLength(7);
		for (const row of rows) {
			expect(within(row).getAllByRole("rowheader")).toHaveLength(1);
			expect(within(row).getAllByRole("gridcell")).toHaveLength(53);
		}
		expect(within(rows[1]!).getByRole("rowheader")).toHaveTextContent(
			"segunda-feira"
		);
	});

	it("has a single tab stop, on today", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const stops = screen
			.getAllByRole("link")
			.filter((link) => link.getAttribute("tabindex") === "0");
		expect(stops).toEqual([cellLink(TODAY)]);
		expect(cellLink(TODAY)).toHaveAttribute("aria-current", "date");
	});

	it("flags the current week's column", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const current = document.querySelectorAll("[data-current-week]");
		expect(current).toHaveLength(7);
		for (const cell of current) {
			expect(cell).toHaveAttribute("data-col", String(grid.today_week_index));
		}
	});

	it("scrolls the current week into view on mount", async () => {
		vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
			function (this: HTMLElement) {
				return this.hasAttribute("data-current-week") ? 2000 : 0;
			}
		);
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(32);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
		const setScroll = vi.spyOn(Element.prototype, "scrollLeft", "set");

		await renderInRouter(<HeatmapGrid grid={grid} />);

		expect(setScroll).toHaveBeenCalledWith(
			scrollLeftFor({ offsetLeft: 2000, offsetWidth: 32 }, 400)
		);
	});

	it("labels the months where they start", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		for (const month of ["jan", "fev", "out", "dez"]) {
			expect(screen.getByText(month)).toBeInTheDocument();
		}
	});

	it("moves by week with ←/→ and by day with ↑/↓, never into the future", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const user = userEvent.setup();
		act(() => cellLink(TODAY).focus());

		await user.keyboard("{ArrowLeft}");
		expect(cellLink("2026-10-02")).toHaveFocus();
		await user.keyboard("{ArrowUp}");
		expect(cellLink("2026-10-01")).toHaveFocus();
		await user.keyboard("{ArrowDown}{ArrowRight}");
		expect(cellLink(TODAY)).toHaveFocus();

		// Saturday and the next weeks have not happened yet.
		await user.keyboard("{ArrowRight}");
		expect(cellLink(TODAY)).toHaveFocus();
		await user.keyboard("{ArrowDown}");
		expect(cellLink(TODAY)).toHaveFocus();
	});

	it("goes along the weekday with Home/End and moves the tab stop", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const user = userEvent.setup();
		act(() => cellLink(TODAY).focus());

		await user.keyboard("{Home}");
		// The first Friday of 2026.
		expect(cellLink("2026-01-02")).toHaveFocus();
		expect(cellLink("2026-01-02")).toHaveAttribute("tabindex", "0");
		expect(cellLink(TODAY)).toHaveAttribute("tabindex", "-1");
		await user.keyboard("{End}");
		expect(cellLink(TODAY)).toHaveFocus();
	});

	it("shows the day and the ratio in a tooltip on focus and on hover", async () => {
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const user = userEvent.setup();

		act(() => cellLink(TODAY).focus());
		expect(tooltip()).toHaveTextContent("sexta-feira, 9 de outubro (hoje)");
		expect(tooltip()).toHaveTextContent("1 de 2 hábitos (50%)");
		expect(tooltip()).toHaveAttribute("aria-hidden", "true");

		await user.hover(cellLink("2026-10-05"));
		expect(tooltip()).toHaveTextContent("segunda-feira, 5 de outubro");
		expect(tooltip()).toHaveTextContent("1 de 1 hábito (100%)");
		await user.hover(cellLink("2026-10-03"));
		expect(tooltip()).toHaveTextContent("Nenhum hábito previsto");
	});

	it("plays the entrance sweep", async () => {
		reduceMotion(false);
		await renderInRouter(<HeatmapGrid grid={grid} />);
		expect(screen.getByRole("grid")).toHaveAttribute("data-animate");
	});

	it("has no entrance animation with prefers-reduced-motion", async () => {
		reduceMotion(true);
		await renderInRouter(<HeatmapGrid grid={grid} />);
		expect(screen.getByRole("grid")).not.toHaveAttribute("data-animate");
	});

	it("ends the sweep on the first interaction", async () => {
		reduceMotion(false);
		await renderInRouter(<HeatmapGrid grid={grid} />);
		const user = userEvent.setup();
		await user.pointer({ keys: "[MouseLeft]", target: cellLink("2026-10-01") });
		expect(screen.getByRole("grid")).not.toHaveAttribute("data-animate");
	});
});

describe("nextCellIndex", () => {
	// Two weeks; the last three days of the second week are not reachable.
	const navigable = [
		...Array<boolean>(7).fill(true),
		true,
		true,
		true,
		true,
		false,
		false,
		false,
	];

	it("steps a day or a week and stays at the edges", () => {
		expect(nextCellIndex(navigable, 8, "ArrowLeft")).toBe(1);
		expect(nextCellIndex(navigable, 1, "ArrowLeft")).toBeNull();
		expect(nextCellIndex(navigable, 7, "ArrowUp")).toBe(6);
		expect(nextCellIndex(navigable, 10, "ArrowDown")).toBeNull();
		expect(nextCellIndex(navigable, 5, "ArrowRight")).toBeNull();
		expect(nextCellIndex(navigable, 3, "Enter")).toBeNull();
	});

	it("goes to the first or last reachable day of the weekday", () => {
		expect(nextCellIndex(navigable, 9, "Home")).toBe(2);
		expect(nextCellIndex(navigable, 2, "End")).toBe(9);
		expect(nextCellIndex(navigable, 5, "End")).toBeNull();
	});

	it("does not scroll past the start for early weeks", () => {
		expect(scrollLeftFor({ offsetLeft: 50, offsetWidth: 32 }, 400)).toBe(0);
	});
});
