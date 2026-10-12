// The day screen opened from the heatmap (2.4.0): Esc goes back to the
// heatmap, ←/→ and the arrows step between days. TODAY = Friday 2026-10-09.
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const water = habit({
	id: "0199c9a0-1111-7000-8000-000000000001",
	name: "Beber água",
});

const routes = defaultRoutes({
	"GET /v1/habits": () => json({ habits: [water] }),
	"GET /v1/day": (request) =>
		json({
			date: new URL(request.url).searchParams.get("date"),
			possible_habits: [water],
			completed_habit_ids: [],
		}),
});

function openDay(date: string) {
	const app = renderApp(`/day/${date}`, { routes });
	const path = () => app.router.state.location.pathname;
	return { ...app, path };
}

const title = () => screen.findByRole("heading", { level: 1 });

describe("Esc on the day screen", () => {
	it("goes back to the heatmap", async () => {
		const { user, path } = openDay("2026-10-05");
		expect(await title()).toHaveTextContent("segunda-feira");
		await user.keyboard("{Escape}");
		await waitFor(() => expect(path()).toBe("/"));
	});

	it("only closes an open dialog", async () => {
		const { user, path } = openDay("2026-10-05");
		await user.click(
			await screen.findByRole("button", { name: "Editar este dia" })
		);
		expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
		);
		expect(path()).toBe("/day/2026-10-05");
	});

	it("does nothing while typing in a field", async () => {
		const { user, path } = openDay("2026-10-05");
		await title();
		const field = document.createElement("input");
		document.body.append(field);
		field.focus();
		await user.keyboard("{Escape}{ArrowLeft}");
		expect(path()).toBe("/day/2026-10-05");
		field.remove();
	});

	it("is announced on the back link", async () => {
		openDay("2026-10-05");
		expect(
			await screen.findByRole("link", { name: /Voltar ao histórico/ })
		).toHaveAttribute("aria-keyshortcuts", "Escape");
	});
});

describe("neighbor days", () => {
	it("steps with ←/→ and with the arrows", async () => {
		const { user, path } = openDay("2026-10-05");
		await title();

		await user.keyboard("{ArrowLeft}");
		await waitFor(() => expect(path()).toBe("/day/2026-10-04"));
		expect(await title()).toHaveTextContent("domingo");

		await user.keyboard("{ArrowRight}");
		await waitFor(() => expect(path()).toBe("/day/2026-10-05"));

		await user.click(
			await screen.findByRole("link", {
				name: "Próximo dia: terça-feira, 6 de outubro",
			})
		);
		await waitFor(() => expect(path()).toBe("/day/2026-10-06"));
		expect(
			screen.getByRole("link", {
				name: "Dia anterior: segunda-feira, 5 de outubro",
			})
		).toHaveAttribute("href", "/day/2026-10-05");
	});

	it("never goes past today", async () => {
		const { user, path } = openDay(TODAY);
		await title();
		expect(screen.getByRole("button", { name: "Próximo dia" })).toBeDisabled();
		await user.keyboard("{ArrowRight}");
		expect(path()).toBe(`/day/${TODAY}`);
	});

	it("stops at January 1 of the heatmap's first year", async () => {
		const { user, path } = openDay("2026-01-01");
		await title();
		expect(screen.getByRole("button", { name: "Dia anterior" })).toBeDisabled();
		await user.keyboard("{ArrowLeft}");
		expect(path()).toBe("/day/2026-01-01");
	});

	it("locks an unlocked past day again when moving to another day", async () => {
		const { user, path } = openDay("2026-10-05");
		await user.click(
			await screen.findByRole("button", { name: "Editar este dia" })
		);
		await user.click(await screen.findByRole("button", { name: "Editar" }));
		expect(await screen.findByText("Editando dia passado")).toBeInTheDocument();

		await user.keyboard("{ArrowLeft}");
		await waitFor(() => expect(path()).toBe("/day/2026-10-04"));
		expect(
			await screen.findByRole("button", { name: "Editar este dia" })
		).toBeInTheDocument();
		expect(screen.queryByText("Editando dia passado")).not.toBeInTheDocument();
	});
});
