// Habits screen (2.4.0): cards that show when each habit happens, and the
// user's order (handle with pointer and keyboard, up/down buttons, phone
// menu). TODAY = Friday 2026-10-09.
import type { Habit } from "@habits/contracts";
import { compareHabitOrder } from "@habits/core";
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	apiError,
	defaultRoutes,
	habit,
	json,
	renderApp,
} from "@/test/harness.tsx";

const ids = {
	ler: "0199c9a0-4444-7000-8000-000000000001",
	correr: "0199c9a0-4444-7000-8000-000000000002",
	meditar: "0199c9a0-4444-7000-8000-000000000003",
};

function server(options: { failPatch?: boolean } = {}) {
	const habits: Habit[] = [
		habit({
			id: ids.ler,
			name: "Ler",
			schedule: { type: "weekdays", days: [1, 3, 5] },
			sort_key: "a0",
		}),
		habit({
			id: ids.correr,
			name: "Correr",
			schedule: { type: "weekdays", days: [1] },
			sort_key: "a1",
		}),
		habit({
			id: ids.meditar,
			name: "Meditar",
			schedule: { type: "interval", every: 8, anchor_date: "2026-10-05" },
			start_date: "2026-10-05",
			sort_key: "a2",
		}),
	];
	const patches: { id: string; body: unknown }[] = [];
	const routes = defaultRoutes({
		"GET /v1/habits": () =>
			json({ habits: [...habits].sort(compareHabitOrder) }),
	});
	for (const habit of habits) {
		routes[`PATCH /v1/habits/${habit.id}`] = async (request) => {
			const body = (await request.json()) as { sort_key: string };
			patches.push({ id: habit.id, body });
			if (options.failPatch) return apiError(404, "not_found");
			habit.sort_key = body.sort_key;
			return json({ habit });
		};
	}
	return { routes, patches };
}

const cardNames = () =>
	within(screen.getByRole("list", { name: "Hábitos ativos" }))
		.getAllByRole("listitem")
		.map((item) => item.querySelector("span")?.textContent);

async function open(options?: { failPatch?: boolean }) {
	const { routes, patches } = server(options);
	const app = renderApp("/habits", { routes });
	await screen.findByRole("list", { name: "Hábitos ativos" });
	return { ...app, patches };
}

describe("habit cards", () => {
	it("light the habit's weekdays and mark today", async () => {
		await open();
		const card = screen.getByText("Ler").closest("li")!;
		expect(within(card).getByText("Repete: seg, qua, sex")).toBeInTheDocument();
		const lit = card.querySelectorAll("[data-on]");
		expect([...lit].map((pill) => pill.textContent)).toEqual(["S", "Q", "S"]);
		// Friday (5) is today.
		expect(card.querySelector("[data-today]")?.textContent).toBe("S");
		expect(card.querySelectorAll("[data-today][data-on]")).toHaveLength(1);
	});

	it("say Hoje, or when the habit happens next", async () => {
		await open();
		const card = (name: string) => screen.getByText(name).closest("li")!;
		expect(within(card("Ler")).getByText("Hoje")).toBeInTheDocument();
		expect(
			within(card("Correr")).getByText("Próxima: seg, 12/10")
		).toBeInTheDocument();
		// Every 8 days from 05/10: next on 13/10.
		expect(
			within(card("Meditar")).getByText("A cada 8 dias")
		).toBeInTheDocument();
		expect(
			within(card("Meditar")).getByText("Próxima: ter, 13/10")
		).toBeInTheDocument();
	});
});

describe("reordering", () => {
	it("moves a habit up with the button, one PATCH, at once", async () => {
		const { user, patches } = await open();
		expect(cardNames()).toEqual(["Ler", "Correr", "Meditar"]);
		expect(
			screen.getByRole("button", { name: "Mover Ler para cima" })
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Mover Meditar para baixo" })
		).toBeDisabled();

		const up = screen.getByRole("button", { name: "Mover Correr para cima" });
		await user.click(up);
		expect(cardNames()).toEqual(["Correr", "Ler", "Meditar"]);
		await waitFor(() => expect(patches).toHaveLength(1));
		expect(patches[0]).toEqual({ id: ids.correr, body: { sort_key: "Zz" } });
		// Now first: the focus falls back to its handle.
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Reordenar Correr" })
			).toHaveFocus()
		);
	});

	it("puts the old order back when saving fails", async () => {
		const { user } = await open({ failPatch: true });
		await user.click(
			screen.getByRole("button", { name: "Mover Meditar para cima" })
		);
		expect(
			await screen.findByText("Não foi possível mover o hábito")
		).toBeInTheDocument();
		await waitFor(() =>
			expect(cardNames()).toEqual(["Ler", "Correr", "Meditar"])
		);
	});

	it("moves with the keyboard on the handle, announcing each step", async () => {
		const { user, patches } = await open();
		const handle = screen.getByRole("button", { name: "Reordenar Ler" });
		expect(handle).toHaveAttribute("aria-roledescription", "alça de arrastar");
		act(() => handle.focus());

		await user.keyboard(" ");
		expect(screen.getByText(/Ler pego\. Posição 1 de 3\./)).toBeInTheDocument();
		await user.keyboard("{ArrowDown}{ArrowDown}");
		expect(screen.getByText("Posição 3 de 3.")).toBeInTheDocument();
		await user.keyboard(" ");

		expect(
			screen.getByText("Ler solto na posição 3 de 3.")
		).toBeInTheDocument();
		expect(cardNames()).toEqual(["Correr", "Meditar", "Ler"]);
		await waitFor(() =>
			expect(patches).toEqual([{ id: ids.ler, body: { sort_key: "a3" } }])
		);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Reordenar Ler" })
			).toHaveFocus()
		);
	});

	it("cancels a keyboard move with Esc", async () => {
		const { user, patches } = await open();
		act(() =>
			screen.getByRole("button", { name: "Reordenar Meditar" }).focus()
		);
		await user.keyboard(" {ArrowUp}{Escape}");
		expect(
			screen.getByText("Movimento cancelado. Meditar continua na posição 3.")
		).toBeInTheDocument();
		expect(cardNames()).toEqual(["Ler", "Correr", "Meditar"]);
		expect(patches).toEqual([]);
	});

	it("moves by dragging the handle", async () => {
		const { user, patches } = await open();
		// Cards 52px tall with 8px between them: tops 0, 60, 120.
		const tops: Record<string, number> = {
			[ids.ler]: 0,
			[ids.correr]: 60,
			[ids.meditar]: 120,
		};
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
			function (this: HTMLElement) {
				const top = tops[this.dataset.habitId ?? ""] ?? 0;
				return {
					top,
					height: 52,
					bottom: top + 52,
					left: 0,
					right: 600,
					width: 600,
					x: 0,
					y: top,
					toJSON: () => ({}),
				} as DOMRect;
			}
		);
		const handle = screen.getByRole("button", { name: "Reordenar Ler" });
		await user.pointer([
			{ keys: "[MouseLeft>]", target: handle, coords: { clientY: 26 } },
			{ target: handle, coords: { clientY: 100 } },
			{ target: handle, coords: { clientY: 160 } },
			{ keys: "[/MouseLeft]", target: handle, coords: { clientY: 160 } },
		]);
		expect(cardNames()).toEqual(["Correr", "Meditar", "Ler"]);
		await waitFor(() =>
			expect(patches).toEqual([{ id: ids.ler, body: { sort_key: "a3" } }])
		);
		vi.restoreAllMocks();
	});

	it("offers the moves in the phone menu", async () => {
		const { user, patches } = await open();
		await user.click(
			screen.getByRole("button", { name: "Mais ações para Meditar" })
		);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Mover para baixo" })
		).toHaveAttribute("data-disabled");
		await user.click(
			within(menu).getByRole("menuitem", { name: "Mover para cima" })
		);
		expect(cardNames()).toEqual(["Ler", "Meditar", "Correr"]);
		await waitFor(() => expect(patches).toHaveLength(1));
		expect(patches[0]?.id).toBe(ids.meditar);
	});
});

describe("reading screens", () => {
	it("are centered columns", async () => {
		const { router } = renderApp("/habits");
		for (const [path, name] of [
			["/habits", "Hábitos"],
			["/settings", "Ajustes"],
			["/today", undefined],
		] as const) {
			await router.navigate({ to: path });
			const heading = await screen.findByRole("heading", {
				level: 1,
				...(name && { name }),
			});
			expect(heading.closest("section")).toHaveClass("mx-auto", "max-w-2xl");
		}
	});
});
