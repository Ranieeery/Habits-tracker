// The home screen (2.4.0): overview numbers, the "Hoje" panel, the loading,
// empty and error states, and the new frame only on "/".
// TODAY = Friday 2026-10-09; the week started on Sunday 2026-10-04.
import type { SummaryDay } from "@habits/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	apiError,
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const read = habit({ id: "0199c9a0-1111-7000-8000-000000000001", name: "Ler" });
const run = habit({
	id: "0199c9a0-1111-7000-8000-000000000002",
	name: "Correr",
});

const day = (
	date: string,
	completed: number,
	possible: number
): SummaryDay => ({
	date,
	completed,
	possible,
});

function routes(
	summaries: Record<number, SummaryDay[]>,
	overrides: Parameters<typeof defaultRoutes>[0] = {}
) {
	return defaultRoutes({
		"GET /v1/habits": () => json({ habits: [read, run] }),
		"GET /v1/summary": (request) => {
			const year = Number(new URL(request.url).searchParams.get("year"));
			return json({ year, days: summaries[year] ?? [] });
		},
		...overrides,
	});
}

/**
 * Waits for the overview (it renders only once every summary it needs is
 * in; generous timeout for the whole grid under a parallel test run).
 */
const overview = () =>
	screen.findByText("Sequência atual", { selector: "dt" }, { timeout: 5000 });

/** The value of one overview number ("4dias", "90%"). */
function stat(label: string) {
	return screen.getByText(label, { selector: "dt" }).nextElementSibling
		?.textContent;
}

const summaryYears = (requests: Request[]) =>
	requests
		.filter((r) => new URL(r.url).pathname.endsWith("/v1/summary"))
		.map((r) => new URL(r.url).searchParams.get("year"));

describe("overview numbers", () => {
	it("shows streaks of strong days and the week and month to date", async () => {
		const { requests } = renderApp("/", {
			routes: routes({
				2026: [
					day("2026-10-01", 0, 4),
					day("2026-10-05", 1, 1),
					day("2026-10-06", 2, 2),
					day("2026-10-07", 4, 5), // 80% counts
					day("2026-10-08", 2, 2),
					day(TODAY, 0, 2), // still open: does not break the streak
				],
			}),
		});

		await overview();
		expect(stat("Sequência atual")).toBe("4dias");
		expect(stat("Melhor em 2026")).toBe("4dias");
		expect(stat("Esta semana")).toBe("75%"); // 9 of 12
		expect(stat("Este mês")).toBe("56%"); // 9 of 16
		// A past day this year broke the streak: last year is not needed.
		expect(summaryYears(requests)).not.toContain("2025");
	});

	it("reads last year when this week started in it", async () => {
		const { requests } = renderApp("/", {
			// Friday 2026-01-02, 12:00 in São Paulo.
			now: Date.UTC(2026, 0, 2, 15, 0),
			routes: routes({
				2025: [
					day("2025-12-29", 1, 1),
					day("2025-12-30", 1, 1),
					day("2025-12-31", 1, 1),
				],
				2026: [day("2026-01-01", 1, 1)],
			}),
		});

		await overview();
		expect(stat("Sequência atual")).toBe("4dias");
		expect(stat("Esta semana")).toBe("100%");
		expect(summaryYears(requests)).toContain("2025");
	});

	it("shows a dash when nothing was possible", async () => {
		renderApp("/", { routes: routes({ 2026: [] }) });
		const value = await screen.findByText("Esta semana", { selector: "dt" });
		expect(value.nextElementSibling).toHaveTextContent("—");
		expect(value.nextElementSibling).toHaveTextContent(
			"nenhum hábito previsto"
		);
	});
});

describe("Hoje panel", () => {
	function panelRoutes(completed: Set<string>) {
		return routes(
			{ 2026: [] },
			{
				"GET /v1/day": (request) =>
					json({
						date: new URL(request.url).searchParams.get("date"),
						possible_habits: [read, run],
						completed_habit_ids: [...completed],
					}),
				[`PUT /v1/habits/${run.id}/completions/${TODAY}`]: async (request) => {
					const body = (await request.json()) as { completed: boolean };
					if (body.completed) completed.add(run.id);
					else completed.delete(run.id);
					return json({ completion: null });
				},
			}
		);
	}

	it("lists today's habits and checks one without leaving the screen", async () => {
		const done = new Set([read.id]);
		const { user, requests } = renderApp("/", { routes: panelRoutes(done) });

		const panel = await screen.findByRole("region", { name: "Hoje" });
		const box = await within(panel).findByRole("checkbox", { name: "Correr" });
		expect(within(panel).getByRole("checkbox", { name: "Ler" })).toBeChecked();
		expect(within(panel).getByText("1 de 2 concluídos")).toBeInTheDocument();

		await user.click(box);
		// Optimistic, like the day view.
		expect(box).toBeChecked();
		expect(within(panel).getByText("2 de 2 concluídos")).toBeInTheDocument();
		expect(await screen.findByText("Marcado: Correr")).toBeInTheDocument();
		await waitFor(() => expect(done.has(run.id)).toBe(true));

		await user.click(screen.getByRole("button", { name: "Desfazer" }));
		await screen.findByText("Alteração desfeita");
		await waitFor(() => expect(done.has(run.id)).toBe(false));
		const bodies = await Promise.all(
			requests.filter((r) => r.method === "PUT").map((r) => r.json())
		);
		expect(bodies).toEqual([{ completed: true }, { completed: false }]);
		expect(
			within(panel).getByRole("link", { name: "Abrir o dia" })
		).toHaveAttribute("href", "/today");
	});

	it("rolls back when saving fails", async () => {
		const { user } = renderApp("/", {
			routes: routes(
				{ 2026: [] },
				{
					"GET /v1/day": () =>
						json({
							date: TODAY,
							possible_habits: [run],
							completed_habit_ids: [],
						}),
					[`PUT /v1/habits/${run.id}/completions/${TODAY}`]: () =>
						apiError(500, "internal_error"),
				}
			),
		});
		const box = await screen.findByRole("checkbox", { name: "Correr" });
		await user.click(box);
		expect(
			await screen.findByText("Não foi possível salvar")
		).toBeInTheDocument();
		await waitFor(() => expect(box).not.toBeChecked());
	});

	it("says when nothing is due today", async () => {
		renderApp("/", { routes: routes({ 2026: [] }) });
		expect(
			await screen.findByText("Nenhum hábito previsto para hoje.")
		).toBeInTheDocument();
	});

	it("shows an error with a retry", async () => {
		let fail = true;
		const { user } = renderApp("/", {
			routes: routes(
				{ 2026: [] },
				{
					"GET /v1/day": () =>
						fail
							? apiError(404, "not_found")
							: json({
									date: TODAY,
									possible_habits: [run],
									completed_habit_ids: [],
								}),
				}
			),
		});
		const panel = await screen.findByRole("region", { name: "Hoje" });
		await within(panel).findByRole("alert");
		fail = false;
		await user.click(
			within(panel).getByRole("button", { name: "Tentar de novo" })
		);
		expect(
			await within(panel).findByRole("checkbox", { name: "Correr" })
		).toBeInTheDocument();
	});
});

describe("heatmap states", () => {
	it("shows the grid skeleton while the year loads", async () => {
		renderApp("/", {
			routes: routes(
				{},
				{ "GET /v1/summary": () => new Promise<Response>(() => {}) }
			),
		});
		expect(
			await screen.findByText("Carregando o histórico…")
		).toBeInTheDocument();
		expect(document.querySelectorAll("[data-skeleton-cell]").length).toBe(
			7 * 53
		);
	});

	it("shows an error with a retry", async () => {
		let fail = true;
		const { user } = renderApp("/", {
			routes: routes(
				{},
				{
					"GET /v1/summary": () =>
						fail ? apiError(404, "not_found") : json({ year: 2026, days: [] }),
				}
			),
		});
		expect(
			await screen.findByText("Não foi possível carregar o histórico")
		).toBeInTheDocument();
		fail = false;
		await user.click(
			screen.getAllByRole("button", { name: "Tentar de novo" })[0]!
		);
		expect(
			await screen.findByRole("grid", { name: "Histórico de 2026" })
		).toBeInTheDocument();
	});

	it("invites to create the first habit when there is none", async () => {
		renderApp("/", {
			routes: defaultRoutes({ "GET /v1/habits": () => json({ habits: [] }) }),
		});
		expect(
			await screen.findByRole("heading", {
				name: "Seu ano começa com um hábito",
			})
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Criar primeiro hábito" })
		).toHaveAttribute("href", "/habits");
		expect(screen.queryByRole("grid")).not.toBeInTheDocument();
	});
});

describe("frame", () => {
	it("is the same on every screen: wordmark and both navigations", async () => {
		const { router } = renderApp("/", { routes: routes({ 2026: [] }) });
		for (const path of ["/", "/habits", "/settings"] as const) {
			await router.navigate({ to: path });
			const home = await screen.findByRole("link", { name: "Habits, início" });
			// The mark (svg) and the name, never the pre-2.4.0 "Habits." text.
			expect(home.querySelector("svg")).not.toBeNull();
			expect(home).toHaveTextContent(/^Habits$/);
			expect(
				screen.getAllByRole("navigation", { name: "Principal" })
			).toHaveLength(2);
		}
	});
});

describe("navigation", () => {
	it("marks the current section in both navigations", async () => {
		const { router } = renderApp("/", { routes: routes({ 2026: [] }) });
		for (const [path, current] of [
			["/", "Histórico"],
			["/habits", "Hábitos"],
			["/settings", "Ajustes"],
		] as const) {
			await router.navigate({ to: path });
			await waitFor(() => {
				for (const nav of screen.getAllByRole("navigation", {
					name: "Principal",
				})) {
					const active = within(nav)
						.getAllByRole("link")
						.filter((link) => link.getAttribute("aria-current") === "page");
					expect(active.map((link) => link.textContent)).toEqual([current]);
					expect(active[0]).toHaveAttribute("data-status", "active");
				}
			});
		}
	});
});
