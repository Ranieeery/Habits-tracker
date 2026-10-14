// The habit actions menu of a day's rows (2.15.0): on the Hoje tab
// (`/today`) and, since 2.16.1, on the days opened from the heatmap (past or
// future); never on the home "Hoje" panel. The "more options" button and the right
// click inside the row open the same menu; neither marks the habit; editing
// stays on the day; archiving is immediate with "Desfazer".
// TODAY = Friday 2026-10-09.
import {
	type DayResponse,
	type Habit,
	UpdateHabitRequest,
} from "@habits/contracts";
import { isHabitPossibleOn, NO_RESCHEDULES } from "@habits/core";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	apiError,
	defaultRoutes,
	habit,
	json,
	NOW,
	renderApp,
	TIME_ZONE,
	TODAY,
} from "@/test/harness.tsx";

const read = habit({
	id: "0199c9a0-1111-7000-8000-000000000001",
	name: "Ler",
	description: "Dez páginas por dia.",
});
const water = habit({
	id: "0199c9a0-1111-7000-8000-000000000002",
	name: "Beber água",
});

/**
 * A small server: days list the habits possible on them (core's rule, so
 * an archived habit stays on today and leaves later days), and PATCH applies
 * the change like the API (`archived` stamps the server's instant).
 */
function server({ failPatch = false } = {}) {
	let habits: Habit[] = [read, water];
	const patches: UpdateHabitRequest[] = [];
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits }),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? TODAY;
			return json({
				date,
				possible_habits: habits.filter((item) =>
					isHabitPossibleOn(item, date, {
						timeZone: TIME_ZONE,
						reschedules: NO_RESCHEDULES,
					})
				),
				completed_habit_ids: [],
			} satisfies DayResponse);
		},
	});
	for (const item of [read, water]) {
		routes[`PATCH /v1/habits/${item.id}`] = async (request) => {
			const body = UpdateHabitRequest.parse(await request.json());
			patches.push(body);
			if (failPatch) return apiError(422, "validation_error");
			const { archived, ...fields } = body;
			habits = habits.map((cached) =>
				cached.id === item.id
					? {
							...cached,
							...fields,
							...(archived !== undefined && {
								archived_at: archived ? NOW : null,
							}),
						}
					: cached
			);
			return json({ habit: habits.find((cached) => cached.id === item.id) });
		};
	}
	return { routes, patches };
}

const puts = (requests: Request[]) =>
	requests.filter((request) => request.method === "PUT");

describe("the habit actions menu", () => {
	it("has a visible button on the Hoje tab", async () => {
		const { routes } = server();
		renderApp("/today", { routes });
		expect(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		).toHaveAttribute("aria-haspopup", "menu");
		expect(
			screen.getByRole("button", { name: "Mais opções de Beber água" })
		).toHaveAttribute("aria-expanded", "false");
	});

	it.each([
		["a past day", "/day/2026-10-05", ["Editar hábito", "Arquivar"]],
		[
			"today opened from the heatmap",
			`/day/${TODAY}`,
			["Editar hábito", "Arquivar"],
		],
		["a future day", "/day/2026-10-11", ["Editar hábito"]],
	])(
		"has the menu on %s, from the button and the right click",
		async (_case, path, items) => {
			const { routes } = server();
			const { user, requests } = renderApp(path, { routes });
			await user.click(
				await screen.findByRole(
					"button",
					{ name: "Mais opções de Beber água" },
					{ timeout: 5000 }
				)
			);
			const menu = await screen.findByRole("menu");
			for (const label of items) {
				expect(
					within(menu).getByRole("menuitem", { name: new RegExp(label) })
				).toBeInTheDocument();
			}
			await user.keyboard("{Escape}");
			await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

			const row = screen.getByText("Beber água").closest("li");
			if (!row) throw new Error("no row");
			expect(fireEvent.contextMenu(row, { clientX: 10, clientY: 10 })).toBe(
				false
			);
			expect(await screen.findByRole("menu")).toBeInTheDocument();
			expect(puts(requests)).toEqual([]);
		}
	);

	it("has no menu on the home Hoje panel", async () => {
		const { routes } = server();
		renderApp("/", { routes });
		const name = await screen.findByText("Beber água", undefined, {
			timeout: 5000,
		});
		expect(
			screen.queryByRole("button", { name: /^Mais opções de/ })
		).toBeNull();
		// The right click there is the browser's own.
		const row = name.closest("li");
		if (!row) throw new Error("no row");
		expect(fireEvent.contextMenu(row)).toBe(true);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("opens from the button with the name, icons and the items of the case", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		const menu = await screen.findByRole("menu");
		expect(within(menu).getByText("Ler")).toBeInTheDocument();
		const items = within(menu).getAllByRole("menuitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"Editar hábitoVale para todos os dias",
			"Ver descrição completa",
			"Arquivar",
		]);
		for (const item of items) {
			expect(item.querySelector("svg[aria-hidden='true']")).not.toBeNull();
		}
		await user.keyboard("{Escape}");

		// Without a description, there is nothing to see.
		await user.click(
			screen.getByRole("button", { name: "Mais opções de Beber água" })
		);
		const other = await screen.findByRole("menu");
		expect(
			within(other)
				.getAllByRole("menuitem")
				.map((item) => item.textContent)
		).toEqual(["Editar hábitoVale para todos os dias", "Arquivar"]);
	});

	it("opens at the pointer on a right click inside the row only, and never marks", async () => {
		const { routes } = server();
		const { requests } = renderApp("/today", { routes });
		const box = await screen.findByRole("checkbox", { name: "Ler" });
		const row = box.closest("li");
		if (!row) throw new Error("no row");

		// Cancelled (no browser menu) inside the row...
		expect(fireEvent.contextMenu(row, { clientX: 40, clientY: 60 })).toBe(
			false
		);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: /Editar hábito/ })
		).toBeInTheDocument();
		fireEvent.keyDown(menu, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		// ...the focus comes back to the row...
		await waitFor(() => expect(box).toHaveFocus());

		// ...and the browser's own menu everywhere else.
		const heading = screen.getByRole("heading", { level: 1 });
		expect(fireEvent.contextMenu(heading)).toBe(true);
		expect(screen.queryByRole("menu")).toBeNull();

		expect(box).not.toBeChecked();
		expect(puts(requests)).toHaveLength(0);
	});

	it("never marks the habit from the button", async () => {
		const { routes } = server();
		const { user, requests } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await screen.findByRole("menu");
		await user.keyboard("{Escape}");
		expect(screen.getByRole("checkbox", { name: "Ler" })).not.toBeChecked();
		expect(puts(requests)).toHaveLength(0);
	});

	it("leaves the browser alone on a touch long press (no menu on the web)", async () => {
		const { routes } = server();
		renderApp("/today", { routes });
		const row = (await screen.findByRole("checkbox", { name: "Ler" })).closest(
			"li"
		);
		if (!row) throw new Error("no row");
		fireEvent.pointerDown(row, { pointerType: "touch" });
		await waitFor(() => expect(row).toHaveAttribute("data-disabled"));
		expect(fireEvent.contextMenu(row)).toBe(true);
		expect(screen.queryByRole("menu")).toBeNull();
		// A mouse brings the right click back.
		fireEvent.pointerDown(row, { pointerType: "mouse", button: 2 });
		await waitFor(() => expect(row).not.toHaveAttribute("data-disabled"));
		expect(fireEvent.contextMenu(row)).toBe(false);
		expect(await screen.findByRole("menu")).toBeInTheDocument();
	});

	it("works with the keyboard: Enter or Space opens, arrows move, Esc closes and focuses the button", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		const button = await screen.findByRole("button", {
			name: "Mais opções de Ler",
		});
		button.focus();
		await user.keyboard("{Enter}");
		const menu = await screen.findByRole("menu");
		expect(button).toHaveAttribute("aria-expanded", "true");
		const items = within(menu).getAllByRole("menuitem");
		await waitFor(() => expect(items[0]).toHaveFocus());
		await user.keyboard("{ArrowDown}");
		expect(items[1]).toHaveFocus();
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		expect(button).toHaveFocus();

		await user.keyboard(" ");
		expect(await screen.findByRole("menu")).toBeInTheDocument();
	});

	it("edits the habit in a dialog with its data and stays on the day", async () => {
		const { routes, patches } = server();
		const { user, router } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(
			await screen.findByRole("menuitem", { name: /Editar hábito/ })
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Editar hábito",
		});
		const name = within(dialog).getByLabelText("Qual é o hábito?");
		expect(name).toHaveValue("Ler");
		await user.clear(name);
		await user.type(name, "Ler livros");
		await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(patches[0]).toMatchObject({ name: "Ler livros" });
		expect(
			await screen.findByRole("checkbox", { name: "Ler livros" })
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/today");
	});

	it("keeps what was typed and the old name when saving fails", async () => {
		const { routes } = server({ failPatch: true });
		const { user } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(
			await screen.findByRole("menuitem", { name: /Editar hábito/ })
		);
		const dialog = await screen.findByRole("dialog");
		const name = within(dialog).getByLabelText("Qual é o hábito?");
		await user.clear(name);
		await user.type(name, "Ler livros");
		await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

		expect(
			await screen.findByText("Não foi possível salvar o hábito")
		).toBeInTheDocument();
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(within(dialog).getByLabelText("Qual é o hábito?")).toHaveValue(
			"Ler livros"
		);
		// The optimistic name was put back (behind the modal dialog).
		await waitFor(() =>
			expect(
				screen.queryByRole("checkbox", { name: "Ler livros", hidden: true })
			).toBeNull()
		);
		expect(
			screen.getByRole("checkbox", { name: "Ler", hidden: true })
		).toBeInTheDocument();
	});

	it("archives at once, keeps today's row as archived and undoes with Desfazer", async () => {
		const { routes, patches } = server();
		const { user, router } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));

		expect(await screen.findByText("Hábito arquivado")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Ler. Sai dos próximos dias. Hoje e o histórico continuam no mapa."
			)
		).toBeInTheDocument();
		// Today keeps it (archived during today still counts today).
		expect(
			await screen.findByRole("checkbox", { name: "Ler, arquivado" })
		).toBeInTheDocument();
		expect(screen.getByText("Arquivado")).toBeInTheDocument();
		expect(patches).toEqual([{ archived: true }]);
		expect(router.state.location.pathname).toBe("/today");

		await user.click(screen.getByRole("button", { name: "Desfazer" }));
		await waitFor(() =>
			expect(patches).toEqual([{ archived: true }, { archived: false }])
		);
		expect(
			await screen.findByRole("checkbox", { name: "Ler" })
		).toBeInTheDocument();
	});

	it("offers Desarquivar for a habit archived today", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
		await screen.findByRole("checkbox", { name: "Ler, arquivado" });
		await user.click(
			screen.getByRole("button", { name: "Mais opções de Ler" })
		);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Desarquivar" })
		).toBeInTheDocument();
		expect(
			within(menu).queryByRole("menuitem", { name: "Arquivar" })
		).toBeNull();
	});

	it("takes an archived habit off a future day", async () => {
		const { routes } = server();
		const { user, router } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
		await screen.findByRole("checkbox", { name: "Ler, arquivado" });
		await router.navigate({
			to: "/day/$date",
			params: { date: "2026-10-11" },
		});
		expect(
			await screen.findByText("Dia futuro, somente leitura")
		).toBeInTheDocument();
		expect(await screen.findByText("Beber água")).toBeInTheDocument();
		expect(screen.queryByText("Ler")).toBeNull();
	});

	it("opens the habit's page from Ver descrição completa", async () => {
		const { routes } = server();
		const { user, router } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "Ver descrição completa" })
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(`/habits/${read.id}`)
		);
	});

	it("animates the menu only with motion allowed", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Mais opções de Ler" })
		);
		const menu = await screen.findByRole("menu");
		const animation = menu.className
			.split(" ")
			.filter((name) => /animate|fade|zoom|duration/.test(name));
		expect(animation.length).toBeGreaterThan(0);
		for (const name of animation) expect(name).toMatch(/^motion-safe:/);
	});
});
