// 2.2.0 schedule types on the web: today's view with mixed types and the
// "Próximos" section, and the habits list (summaries, "Passados",
// incompatible habits). TODAY = 2026-10-09 (Friday).
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const ler = habit({ id: "0199c9a0-1111-7000-8000-000000000001", name: "Ler" });
const filtro = habit({
	id: "0199c9a0-1111-7000-8000-000000000002",
	name: "Trocar filtro",
	schedule: { type: "interval", every: 8, anchor_date: TODAY },
	start_date: TODAY,
});
const condominio = habit({
	id: "0199c9a0-1111-7000-8000-000000000003",
	name: "Pagar condomínio",
	schedule: { type: "monthly_days", days: [20] },
});
const consulta = habit({
	id: "0199c9a0-1111-7000-8000-000000000004",
	name: "Consulta no dermatologista",
	schedule: { type: "once", date: "2026-10-11" },
	start_date: "2026-10-11",
});
const passada = habit({
	id: "0199c9a0-1111-7000-8000-000000000005",
	name: "Vacina",
	schedule: { type: "once", date: "2026-10-01" },
	start_date: "2026-10-01",
});
const lunar = habit({
	id: "0199c9a0-1111-7000-8000-000000000006",
	name: "Lua cheia",
	schedule: { type: "lunar" },
});

const HABITS = [ler, filtro, condominio, consulta, passada, lunar];

function routes() {
	return defaultRoutes({
		"GET /v1/habits": () => json({ habits: HABITS }),
		"GET /v1/day": (request) =>
			json({
				date: new URL(request.url).searchParams.get("date"),
				possible_habits: [ler, filtro],
				completed_habit_ids: [],
			}),
	});
}

describe("today's view with mixed schedule types", () => {
	it("lists today's habits with the same check interaction", async () => {
		renderApp("/today", { routes: routes() });
		expect(
			await screen.findByRole("checkbox", { name: "Trocar filtro" })
		).toBeEnabled();
		expect(screen.getByRole("checkbox", { name: "Ler" })).toBeEnabled();
	});

	it("shows Próximos: the next 14 days of non-weekday habits, read-only", async () => {
		renderApp("/today", { routes: routes() });
		const section = await screen.findByRole("region", { name: "Próximos" });
		const rows = within(section)
			.getAllByRole("listitem")
			.map((row) => row.textContent);
		expect(rows).toEqual([
			"dom, 11/10Consulta no dermatologista",
			"sáb, 17/10Trocar filtro",
			"ter, 20/10Pagar condomínio",
			// 25/10 (the next filter change) is past the 14 days.
		]);
		expect(within(section).queryByRole("checkbox")).not.toBeInTheDocument();
	});

	it("says amanhã for tomorrow", async () => {
		const tomorrow = habit({
			...consulta,
			schedule: { type: "once", date: "2026-10-10" },
			start_date: "2026-10-10",
		});
		renderApp("/today", {
			routes: defaultRoutes({
				"GET /v1/habits": () => json({ habits: [tomorrow] }),
			}),
		});
		const section = await screen.findByRole("region", { name: "Próximos" });
		expect(section).toHaveTextContent("amanhãConsulta no dermatologista");
	});

	it("has no Próximos on other days", async () => {
		renderApp("/day/2026-10-08", { routes: routes() });
		await screen.findByRole("checkbox", { name: "Ler" });
		expect(
			screen.queryByRole("region", { name: "Próximos" })
		).not.toBeInTheDocument();
	});
});

describe("habits list", () => {
	it("shows each repetition in words", async () => {
		renderApp("/habits", { routes: routes() });
		expect(await screen.findByText("A cada 8 dias")).toBeInTheDocument();
		expect(screen.getByText("Todo dia 20")).toBeInTheDocument();
		expect(screen.getByText("Dia 11/10")).toBeInTheDocument();
		expect(screen.getByText("Todos os dias")).toBeInTheDocument();
	});

	it("groups past single dates in a collapsed Passados block", async () => {
		renderApp("/habits", { routes: routes() });
		const summary = await screen.findByText("Passados (1)");
		const details = summary.closest("details")!;
		expect(details).not.toHaveAttribute("open");
		expect(within(details).getByText("Vacina")).toBeInTheDocument();
	});

	it("marks habits of a newer version as incompatible", async () => {
		renderApp("/habits", { routes: routes() });
		const row = (await screen.findByText("Lua cheia")).closest("li")!;
		expect(within(row).getByText("Incompatível")).toBeInTheDocument();
	});
});
