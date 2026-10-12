// Year arrows on the heatmap: from the year the oldest habit started up to
// the current one (TODAY = 2026-10-09).
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultRoutes, habit, json, renderApp } from "@/test/harness.tsx";

const old = habit({
	id: "0199c9a0-1111-7000-8000-000000000001",
	name: "Ler",
	start_date: "2024-11-15",
});

function routes(habits = [old]) {
	return defaultRoutes({
		"GET /v1/habits": () => json({ habits }),
		"GET /v1/summary": (request) =>
			json({
				year: Number(new URL(request.url).searchParams.get("year")),
				days: [],
			}),
	});
}

const title = () => screen.getByRole("heading", { level: 1 });
const previous = () => screen.getByRole("button", { name: "Ano anterior" });
const next = () => screen.getByRole("button", { name: "Próximo ano" });

describe("heatmap year navigation", () => {
	it("starts on the current year and never goes into the future", async () => {
		renderApp("/", { routes: routes() });
		await waitFor(() => expect(previous()).toBeEnabled());
		expect(title()).toHaveTextContent("2026");
		expect(next()).toBeDisabled();
	});

	it("goes back to the year of the oldest habit and returns", async () => {
		const { user, requests } = renderApp("/", { routes: routes() });
		await waitFor(() => expect(previous()).toBeEnabled());

		await user.click(previous());
		expect(title()).toHaveTextContent("2025");
		await user.click(previous());
		expect(title()).toHaveTextContent("2024");
		expect(previous()).toBeDisabled();
		expect(
			await screen.findByRole("region", { name: "Histórico de 2024" })
		).toBeInTheDocument();
		const years = requests
			.filter((r) => new URL(r.url).pathname.endsWith("/v1/summary"))
			.map((r) => new URL(r.url).searchParams.get("year"));
		expect(years).toEqual(expect.arrayContaining(["2026", "2025", "2024"]));

		await user.click(next());
		await user.click(next());
		expect(title()).toHaveTextContent("2026");
		expect(next()).toBeDisabled();
	});

	it("has both arrows disabled without older habits", async () => {
		renderApp("/", { routes: routes([]) });
		expect(
			await screen.findByRole("region", { name: "Histórico de 2026" })
		).toBeInTheDocument();
		expect(previous()).toBeDisabled();
		expect(next()).toBeDisabled();
	});
});
