// The preview of the next 7 days (2.14.0): dashed cells without any hint
// of their content, a tooltip with the date only, the read-only day screen,
// nothing past today + 7, and today and the past unchanged.
// TODAY = Friday 2026-10-09: the preview is Saturday 10 to Friday 16.
import { buildYearGrid, PREVIEW_DAYS } from "@habits/core";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	renderInRouter,
	TODAY,
} from "@/test/harness.tsx";
import { HeatmapGrid } from "./heatmap-grid.tsx";
import { cellLabel, scrollLeftFor } from "./heatmap-utils.ts";

const summary = [
	{ date: "2026-10-05", completed: 1, possible: 1 },
	{ date: TODAY, completed: 1, possible: 2 },
];
const withPreview = buildYearGrid({
	year: 2026,
	today: TODAY,
	summary,
	previewDays: PREVIEW_DAYS,
});
const withoutPreview = buildYearGrid({ year: 2026, today: TODAY, summary });

const PREVIEW = [
	"2026-10-10",
	"2026-10-11",
	"2026-10-12",
	"2026-10-13",
	"2026-10-14",
	"2026-10-15",
	"2026-10-16",
];

const cellLink = (date: string) =>
	document.querySelector<HTMLElement>(`[data-date="${date}"]`);
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

describe("preview cells on the grid", () => {
	it("draws the 7 next days as dashed links without any content hint", async () => {
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		const preview = [...document.querySelectorAll("[data-preview]")];
		expect(preview.map((cell) => cell.getAttribute("data-date"))).toEqual(
			// Row-major order (Saturday 10 is in the bottom row).
			[...PREVIEW.slice(1), PREVIEW[0]]
		);
		for (const date of PREVIEW) {
			const link = cellLink(date)!;
			expect(link.tagName).toBe("A");
			expect(link).toHaveAttribute("href", `/day/${date}`);
			expect(link.className).toContain("border-dashed");
			expect(link.className).not.toMatch(/bg-night-heat|shadow/);
			expect(link).not.toHaveAttribute("data-level");
			// Nothing inside: no dot, count or color per kind.
			expect(link).toBeEmptyDOMElement();
		}
		expect(cellLink("2026-10-16")).toHaveAccessibleName(
			"16 de outubro, dia futuro, toque para ver o que está programado"
		);
	});

	it("keeps the 8th day and the rest of the year as inert placeholders", async () => {
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		// Not a link: the 8th day cannot be opened.
		expect(cellLink("2026-10-17")).toBeNull();
		const placeholders = document.querySelectorAll(
			'[data-relation="future"]:not([data-preview])'
		);
		// October 17 to December 31.
		expect(placeholders).toHaveLength(76);
		for (const square of placeholders) {
			expect(square.tagName).toBe("DIV");
			expect(square).toHaveAttribute("aria-hidden", "true");
			expect(square.className).not.toContain("border-dashed");
		}
		// Same columns as without the preview: up to December 31.
		const row = document.querySelectorAll("[role=row]")[0]!;
		expect(row.querySelectorAll("[role=gridcell]")).toHaveLength(53);
		expect(screen.getByText("dez")).toBeInTheDocument();
	});

	it("crosses New Year only when the 7 days do (today 2026-12-28)", async () => {
		const december = buildYearGrid({
			year: 2026,
			today: "2026-12-28",
			previewDays: PREVIEW_DAYS,
		});
		await renderInRouter(<HeatmapGrid grid={december} />);
		for (const date of [
			"2027-01-01",
			"2027-01-02",
			"2027-01-03",
			"2027-01-04",
		]) {
			expect(cellLink(date)).toHaveAttribute("data-preview");
		}
		expect(cellLink("2027-01-05")).toBeNull();
		const row = document.querySelectorAll("[role=row]")[0]!;
		expect(row.querySelectorAll("[role=gridcell]")).toHaveLength(54);
		expect(screen.getAllByText("jan")).toHaveLength(2);
	});

	it("keeps today and the past exactly as without the preview", async () => {
		await renderInRouter(<HeatmapGrid grid={withoutPreview} />);
		const before = [...document.querySelectorAll<HTMLElement>("a[data-date]")]
			.filter((link) => link.dataset.date! <= TODAY)
			.map((link) => link.outerHTML);
		document.body.replaceChildren();
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		const after = [...document.querySelectorAll<HTMLElement>("a[data-date]")]
			.filter((link) => link.dataset.date! <= TODAY)
			.map((link) => link.outerHTML);
		expect(after).toEqual(before);
		expect(cellLink(TODAY)).toHaveAttribute("aria-current", "date");
		expect(cellLink(TODAY)).toHaveAttribute("tabindex", "0");
	});

	it("shows only the date in the tooltip, on hover and on focus", async () => {
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		const user = userEvent.setup();
		await user.hover(cellLink("2026-10-13")!);
		expect(tooltip()).toHaveTextContent("terça-feira, 13 de outubro");
		expect(tooltip()).toHaveTextContent("Dia futuro");
		expect(tooltip()).not.toHaveTextContent(/hábito|%/);

		act(() => cellLink("2026-10-10")!.focus());
		expect(tooltip()).toHaveTextContent("sábado, 10 de outubro");
	});

	it("reaches the preview days with the keyboard, up to today + 7", async () => {
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		const user = userEvent.setup();
		act(() => cellLink(TODAY)!.focus());
		await user.keyboard("{ArrowDown}");
		expect(cellLink("2026-10-10")).toHaveFocus();
		act(() => cellLink(TODAY)!.focus());
		await user.keyboard("{ArrowRight}");
		expect(cellLink("2026-10-16")).toHaveFocus();
		// Saturday 17 is not part of it.
		await user.keyboard("{ArrowDown}");
		expect(cellLink("2026-10-16")).toHaveFocus();
	});

	it("scrolls the preview's last column near the right edge", async () => {
		// The preview ends on Friday 16, in the week after today's.
		const previewCol = withPreview.today_week_index! + 1;
		vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
			function (this: HTMLElement) {
				return this.dataset.col === String(previewCol) ? 2000 : 0;
			}
		);
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(32);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
		const setScroll = vi.spyOn(Element.prototype, "scrollLeft", "set");
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		expect(setScroll).toHaveBeenCalledWith(
			scrollLeftFor({ offsetLeft: 2000, offsetWidth: 32 }, 400)
		);
	});

	it("sweeps with the other cells, and not at all with reduced motion", async () => {
		reduceMotion(false);
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		expect(screen.getByRole("grid")).toHaveAttribute("data-animate");
		expect(cellLink("2026-10-12")!.style.getPropertyValue("--step")).toBe("0");
		document.body.replaceChildren();

		reduceMotion(true);
		await renderInRouter(<HeatmapGrid grid={withPreview} />);
		expect(screen.getByRole("grid")).not.toHaveAttribute("data-animate");
	});

	it("labels a preview cell without its content", () => {
		const cell = withPreview.weeks
			.flatMap((week) => week.days)
			.find((day) => day.date === "2026-10-12")!;
		expect(cellLabel(cell)).toBe(
			"12 de outubro, dia futuro, toque para ver o que está programado"
		);
	});
});

describe("the preview day screen", () => {
	const read = habit({
		id: "0199c9a0-2222-7000-8000-000000000001",
		name: "Ler",
		description: "Pelo menos **10 páginas**",
	});
	const mondays = habit({
		id: "0199c9a0-2222-7000-8000-000000000002",
		name: "Academia",
		schedule: { type: "weekdays", days: [1] },
	});
	const report = habit({
		id: "0199c9a0-2222-7000-8000-000000000003",
		name: "Entregar relatório",
		schedule: { type: "deadline", due_date: "2026-10-14" },
		start_date: TODAY,
	});
	const archived = habit({
		id: "0199c9a0-2222-7000-8000-000000000004",
		name: "Arquivado",
		archived_at: Date.UTC(2026, 9, 1),
	});
	const routes = (deadline_completions: unknown[] = []) =>
		defaultRoutes({
			"GET /v1/habits": () =>
				json({
					habits: [read, mondays, report, archived],
					deadline_completions,
				}),
		});

	it("opens from a preview cell, read only, with what is planned", async () => {
		const { user, router, requests } = renderApp("/", { routes: routes() });
		const cell = await screen.findByRole(
			"link",
			{ name: /^14 de outubro, dia futuro/ },
			{ timeout: 5000 }
		);
		await user.click(cell);
		expect(router.state.location.pathname).toBe("/day/2026-10-14");
		expect(
			await screen.findByText("Dia futuro, somente leitura")
		).toBeInTheDocument();
		const list = screen.getByRole("list", { name: "Programado para este dia" });
		expect(within(list).getByText("Ler")).toBeInTheDocument();
		expect(within(list).getByText("Pelo menos 10 páginas")).toBeInTheDocument();
		expect(within(list).getByText("Vence neste dia")).toBeInTheDocument();
		expect(within(list).queryByText("Academia")).toBeNull();
		expect(within(list).queryByText("Arquivado")).toBeNull();
		// Nothing to mark, create, edit or undo.
		expect(screen.queryByRole("checkbox")).toBeNull();
		expect(
			screen.queryByRole("button", { name: /Novo hábito|Editar este dia/ })
		).toBeNull();
		// Built from the habits already loaded: no day request for it.
		expect(
			requests.some((request) =>
				request.url.includes("/v1/day?date=2026-10-14")
			)
		).toBe(false);
	});

	it("leaves out a deadline task already done", async () => {
		renderApp("/day/2026-10-14", {
			routes: routes([{ habit_id: report.id, date: TODAY }]),
		});
		await screen.findByText("Dia futuro, somente leitura");
		expect(await screen.findByText("Ler")).toBeInTheDocument();
		expect(screen.queryByText("Entregar relatório")).toBeNull();
	});

	it("says when nothing is planned", async () => {
		renderApp("/day/2026-10-12", {
			routes: defaultRoutes({
				"GET /v1/habits": () => json({ habits: [mondays] }),
			}),
		});
		// Monday 12 has "Academia"; Tuesday 13 has nothing.
		expect(await screen.findByText("Academia")).toBeInTheDocument();
		document.body.replaceChildren();
		renderApp("/day/2026-10-13", {
			routes: defaultRoutes({
				"GET /v1/habits": () => json({ habits: [mondays] }),
			}),
		});
		expect(
			await screen.findByText("Nada programado para este dia")
		).toBeInTheDocument();
	});

	it("blocks any date past today + 7 with a clear message", async () => {
		for (const date of ["2026-10-17", "2027-03-01"]) {
			const { router } = renderApp(`/day/${date}`, { routes: routes() });
			expect(
				await screen.findByText("Este dia ainda está longe")
			).toBeInTheDocument();
			expect(screen.getByText(/próximos 7 dias/)).toBeInTheDocument();
			expect(screen.queryByText("Ler")).toBeNull();
			expect(
				screen.getAllByRole("link", { name: /Voltar ao histórico/ }).length
			).toBeGreaterThan(0);
			expect(router.state.location.pathname).toBe(`/day/${date}`);
			document.body.replaceChildren();
		}
	});

	it("keeps today and past days as they were (checkboxes)", async () => {
		renderApp("/day/2026-10-08", {
			routes: defaultRoutes({
				"GET /v1/day": () =>
					json({
						date: "2026-10-08",
						possible_habits: [read],
						completed_habit_ids: [],
					}),
			}),
		});
		expect(
			await screen.findByRole("checkbox", { name: "Ler" })
		).toBeInTheDocument();
		expect(screen.queryByText("Dia futuro, somente leitura")).toBeNull();
	});
});
