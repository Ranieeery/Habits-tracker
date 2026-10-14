// Habit descriptions (2.12.0): the note icon on today's rows, the quick look
// (first lines, "Abrir descrição completa" only when something is left out),
// the habit's page with the whole text and "Editar", and the form.
import type { DayResponse, Habit } from "@habits/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const ids = {
	ler: "0199c9a0-7777-7000-8000-000000000001",
	treinar: "0199c9a0-7777-7000-8000-000000000002",
	beber: "0199c9a0-7777-7000-8000-000000000003",
	rico: "0199c9a0-7777-7000-8000-000000000004",
};
const LONG_NAME =
	"Ler um capítulo do livro de cabeceira antes de dormir, sem celular por perto";
const WORD = "Pneumoultramicroscopicossilicovulcanoconiótico";
const RICH = [
	`Veja [o guia](https://exemplo.com/guia) e *leia* ${WORD}.`,
	"- um",
	"- dois **forte**",
	"- três",
	"- quatro",
	"> citação literal",
].join("\n");
const SHORT = "Livro atual: **Duna**";
const LONG = [
	"**Treino A**",
	"- agachamento",
	"- supino",
	"- remada",
	"- prancha",
	"[planilha](https://exemplo.com/treino)",
	"[perigo](javascript:alert(1))",
].join("\n");

function server() {
	const habits: Habit[] = [
		habit({ id: ids.ler, name: "Ler", description: SHORT }),
		habit({ id: ids.treinar, name: "Treinar", description: LONG }),
		habit({ id: ids.beber, name: "Beber água" }),
		habit({ id: ids.rico, name: LONG_NAME, description: RICH }),
	];
	const patches: unknown[] = [];
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits }),
		"GET /v1/day": () =>
			json({
				date: TODAY,
				possible_habits: habits,
				completed_habit_ids: [],
				overdue: [],
			} satisfies DayResponse),
		[`PATCH /v1/habits/${ids.treinar}`]: async (request) => {
			const body = (await request.json()) as Partial<Habit>;
			patches.push(body);
			Object.assign(habits[1]!, body);
			return json({ habit: habits[1] });
		},
	});
	return { routes, patches };
}

describe("description on today's rows", () => {
	it("shows the note icon only for habits with a description", async () => {
		const { routes } = server();
		renderApp("/today", { routes });
		await screen.findByRole("checkbox", { name: "Ler" });

		expect(
			screen.getByRole("button", { name: "Descrição de Ler" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Descrição de Treinar" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Descrição de Beber água" })
		).toBeNull();
	});

	it("shows the first line under the name, as the checkbox description", async () => {
		const { routes } = server();
		renderApp("/today", { routes });
		const ler = await screen.findByRole("checkbox", { name: "Ler" });
		expect(ler).toHaveAccessibleDescription("Livro atual: Duna");
		expect(screen.getByText("Livro atual: Duna")).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: "Treinar" })
		).toHaveAccessibleDescription("Treino A");
		expect(
			screen.getByRole("checkbox", { name: "Beber água" })
		).not.toHaveAccessibleDescription();
	});

	it("opens a short description whole, still with the link to the page", async () => {
		const { routes } = server();
		const { user, requests } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Descrição de Ler" })
		);

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("Duna").tagName).toBe("STRONG");
		// 2.14.1: the footer is always there; nothing was cut, so no fade.
		expect(
			within(dialog).getByRole("link", { name: "Abrir descrição completa" })
		).toHaveAttribute("href", `/habits/${ids.ler}`);
		expect(dialog.querySelector("[data-faded]")).toBeNull();
		// Opening it is not marking it.
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
	});

	it("previews a long description and leads to the habit's page", async () => {
		const { routes } = server();
		const { user, router } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("button", { name: "Descrição de Treinar" })
		);

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
		expect(within(dialog).queryByText("prancha")).toBeNull();
		expect(dialog.querySelector("[data-faded]")).not.toBeNull();
		await user.click(
			within(dialog).getByRole("link", { name: "Abrir descrição completa" })
		);

		await waitFor(() =>
			expect(router.state.location.pathname).toBe(`/habits/${ids.treinar}`)
		);
		expect(
			await screen.findByRole("heading", { name: "Treinar" })
		).toBeInTheDocument();
	});
});

describe("quick look layout (2.14.1)", () => {
	async function open() {
		const { routes } = server();
		const rendered = renderApp("/today", { routes });
		await rendered.user.click(
			await screen.findByRole("button", { name: `Descrição de ${LONG_NAME}` })
		);
		return { ...rendered, dialog: await screen.findByRole("dialog") };
	}

	it("names the dialog and keeps a long name whole for assistive tech", async () => {
		const { dialog } = await open();
		expect(dialog).toHaveAccessibleName(`Descrição de ${LONG_NAME}`);
		const title = within(dialog).getByText(LONG_NAME);
		// Clamped to two lines on screen, whole in the DOM and on hover.
		expect(title).toHaveClass("line-clamp-2", "font-display");
		expect(title).toHaveAttribute("title", LONG_NAME);
	});

	it("renders each supported element and leaves the rest literal", async () => {
		const { dialog } = await open();
		expect(within(dialog).getByText("forte").tagName).toBe("STRONG");
		expect(within(dialog).getByText("leia").tagName).toBe("EM");
		const guide = within(dialog).getByRole("link", { name: "o guia" });
		expect(guide).toHaveAttribute("href", "https://exemplo.com/guia");
		expect(guide).toHaveAttribute("target", "_blank");
		expect(guide).toHaveAttribute("rel", "noopener noreferrer");
		// Four lines at most (core): the paragraph and three items.
		expect(
			within(dialog)
				.getAllByRole("listitem")
				.map((item) => item.textContent)
		).toEqual(["um", "dois forte", "três"]);
		// Long words wrap inside the card instead of widening it.
		const body = dialog.querySelector("[data-faded]");
		expect(body).toHaveClass("wrap-anywhere");
		expect(body).toHaveTextContent(WORD);
	});

	it("separates the action and reaches it after the body's links", async () => {
		const { dialog, user, router } = await open();
		const action = within(dialog).getByRole("link", {
			name: "Abrir descrição completa",
		});
		expect(action).toHaveClass("min-h-touch", "border-t");
		const guide = within(dialog).getByRole("link", { name: "o guia" });
		guide.focus();
		await user.tab();
		expect(action).toHaveFocus();
		await user.keyboard("{Enter}");
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(`/habits/${ids.rico}`)
		);
	});

	it("moves only under motion-safe, so reduced motion stills it", async () => {
		const { dialog } = await open();
		const arrow = within(dialog)
			.getByRole("link", { name: "Abrir descrição completa" })
			.querySelector("svg");
		const classes = [...(arrow?.classList ?? [])];
		const moving = classes.filter((c) =>
			/transition|translate|duration/.test(c)
		);
		expect(moving.length).toBeGreaterThan(0);
		expect(moving.every((c) => c.startsWith("motion-safe:"))).toBe(true);
	});

	it("shows no note icon, so no card, without a description", async () => {
		await open();
		expect(
			screen.queryByRole("button", { name: "Descrição de Beber água" })
		).toBeNull();
	});
});

describe("habit page", () => {
	it("renders the whole description with safe links only", async () => {
		const { routes } = server();
		renderApp(`/habits/${ids.treinar}`, { routes });
		await screen.findByRole("heading", { name: "Treinar" });

		expect(screen.getByText("Treino A").tagName).toBe("STRONG");
		expect(
			screen.getAllByRole("listitem").map((item) => item.textContent)
		).toEqual(["agachamento", "supino", "remada", "prancha"]);
		const link = screen.getByRole("link", { name: "planilha" });
		expect(link).toHaveAttribute("href", "https://exemplo.com/treino");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(screen.queryByRole("link", { name: "perigo" })).toBeNull();
		expect(
			screen.getByText("[perigo](javascript:alert(1))")
		).toBeInTheDocument();
	});

	it("uses the reading typography and keeps unsupported marks literal", async () => {
		const { routes } = server();
		renderApp(`/habits/${ids.rico}`, { routes });
		await screen.findByRole("heading", { name: LONG_NAME });

		const quote = screen.getByText("> citação literal");
		expect(quote.closest("blockquote")).toBeNull();
		const body = quote.closest(".wrap-anywhere");
		expect(body).toHaveClass("leading-7", "text-night-foreground");
		// The whole text: nothing faded on the page.
		expect(body).not.toHaveAttribute("data-faded");
	});

	it("edits the description from the page", async () => {
		const { routes, patches } = server();
		const { user } = renderApp(`/habits/${ids.treinar}`, { routes });
		await user.click(await screen.findByRole("button", { name: "Editar" }));

		const dialog = await screen.findByRole("dialog", {
			name: "Editar hábito",
		});
		const field = within(dialog).getByLabelText("Descrição (opcional)");
		expect(field).toHaveValue(LONG);
		await user.clear(field);
		await user.type(field, "Treino B");
		await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

		await waitFor(() => expect(patches).toHaveLength(1));
		expect(patches[0]).toMatchObject({
			name: "Treinar",
			description: "Treino B",
		});
	});

	it("says when the habit does not exist", async () => {
		const { routes } = server();
		renderApp("/habits/0199c9a0-7777-7000-8000-00000000ffff", { routes });
		expect(
			await screen.findByText("Hábito não encontrado")
		).toBeInTheDocument();
	});
});
