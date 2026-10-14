// "Descartar alterações?" (2.16.2): the habit form's dialogs ask before
// closing only when the fields differ from the ones they opened with.
import {
	CreateHabitRequest,
	type DayResponse,
	type Habit,
	UpdateHabitRequest,
} from "@habits/contracts";
import { isHabitPossibleOn, NO_RESCHEDULES } from "@habits/core";
import { screen, waitFor, within } from "@testing-library/react";
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
	description: "Um capítulo",
	schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
});

function server({ failPatch = false } = {}) {
	let habits: Habit[] = [read];
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
		"POST /v1/habits": async (request) => {
			const body = CreateHabitRequest.parse(await request.json());
			const created = habit({
				id: body.id ?? "0199c9a0-2222-7000-8000-000000000001",
				name: body.name,
				schedule: body.schedule,
				start_date: body.start_date,
				created_at: NOW,
				updated_at: NOW,
			});
			habits = [...habits, created];
			return json({ habit: created }, 201);
		},
		[`PATCH /v1/habits/${read.id}`]: async (request) => {
			const body = UpdateHabitRequest.parse(await request.json());
			if (failPatch) return apiError(422, "validation_error");
			habits = habits.map((item) =>
				item.id === read.id ? { ...item, ...body } : item
			);
			return json({ habit: habits.find((item) => item.id === read.id) });
		},
	});
	return { routes };
}

type User = ReturnType<typeof renderApp>["user"];

/** Every way into the habit form, with the dialog's name. */
const ENTRIES: {
	label: string;
	path: string;
	dialog: string;
	open: (user: User) => Promise<void>;
}[] = [
	{
		label: "creating from today",
		path: "/today",
		dialog: "Novo hábito",
		open: async (user) => {
			await user.click(
				await screen.findByRole("button", { name: "Novo hábito" })
			);
		},
	},
	{
		label: "creating from Hábitos",
		path: "/habits",
		dialog: "Criar hábito",
		open: async (user) => {
			await user.click(
				await screen.findByRole("button", { name: "Novo hábito" })
			);
		},
	},
	{
		label: "editing from Hábitos",
		path: "/habits",
		dialog: "Editar hábito",
		open: async (user) => {
			const [button] = await screen.findAllByRole("button", {
				name: "Editar Ler",
			});
			if (button) await user.click(button);
		},
	},
	{
		label: "editing from the actions menu",
		path: "/today",
		dialog: "Editar hábito",
		open: async (user) => {
			await user.click(
				await screen.findByRole("button", { name: "Mais opções de Ler" })
			);
			await user.click(
				await screen.findByRole("menuitem", { name: /Editar hábito/ })
			);
		},
	},
];

type Exit = "Esc" | "a click outside" | "Fechar";

/** The topmost overlay: Radix gives a pointer down there to the top layer. */
const topOverlay = () => {
	const overlays = document.querySelectorAll<HTMLElement>(
		'[data-slot="dialog-overlay"]'
	);
	const last = overlays[overlays.length - 1];
	if (!last) throw new Error("No dialog overlay");
	return last;
};

async function leave(user: User, exit: Exit, dialog: HTMLElement) {
	if (exit === "Esc") await user.keyboard("{Escape}");
	else if (exit === "a click outside") await user.click(topOverlay());
	else await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
}

async function openForm(entry: (typeof ENTRIES)[number]) {
	const { routes } = server();
	const rendered = renderApp(entry.path, { routes });
	await entry.open(rendered.user);
	const dialog = await screen.findByRole("dialog", { name: entry.dialog });
	return { ...rendered, dialog };
}

const nameField = (dialog: HTMLElement) =>
	within(dialog).getByLabelText("Qual é o hábito?");

const closed = () =>
	waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

const EXITS: Exit[] = ["Esc", "a click outside", "Fechar"];
const CASES = ENTRIES.flatMap((entry) =>
	EXITS.map((exit) => ({ entry, exit, name: `${entry.label}, ${exit}` }))
);

describe("closing the habit form", () => {
	it.each(CASES)(
		"closes at once without changes ($name)",
		async ({ entry, exit }) => {
			const { user, dialog } = await openForm(entry);
			await leave(user, exit, dialog);
			await closed();
			expect(screen.queryByRole("alertdialog")).toBeNull();
		}
	);

	it.each(CASES)("asks with changes ($name)", async ({ entry, exit }) => {
		const { user, dialog } = await openForm(entry);
		await user.type(nameField(dialog), " novo");
		await leave(user, exit, dialog);

		const alert = await screen.findByRole("alertdialog", {
			name: "Descartar alterações?",
		});
		expect(alert).toHaveAccessibleDescription(
			"Você tem alterações que não foram salvas."
		);
		expect(
			within(alert).getByRole("button", { name: "Continuar editando" })
		).toHaveFocus();
		expect(
			within(alert)
				.getAllByRole("button")
				.map((b) => b.textContent)
		).toEqual(["Continuar editando", "Descartar"]);
		// The form is still there, behind the question.
		expect(
			screen.getByRole("dialog", { name: entry.dialog, hidden: true })
		).toBeInTheDocument();
	});

	it("asks when only one weekday changed, and not once it is back", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		const monday = within(dialog).getByRole("button", {
			name: "segunda-feira",
		});
		await user.click(monday);
		await user.keyboard("{Escape}");
		await user.click(
			await screen.findByRole("button", { name: "Continuar editando" })
		);
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

		await user.click(monday);
		await user.keyboard("{Escape}");
		await closed();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("closes at once after typing and erasing, or typing only spaces", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		const name = nameField(dialog);
		await user.type(name, "Correr");
		await user.clear(name);
		await user.type(name, "   ");
		await user.keyboard("{Escape}");
		await closed();
	});

	it("keeps editing with the data and the focus where they were", async () => {
		const { user, dialog } = await openForm(ENTRIES[2]!);
		const name = nameField(dialog);
		await user.clear(name);
		await user.type(name, "Ler livros");
		await user.keyboard("{Escape}");
		await user.click(
			await screen.findByRole("button", { name: "Continuar editando" })
		);

		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("dialog", { name: "Editar hábito" })).toBeVisible();
		expect(name).toHaveValue("Ler livros");
		await waitFor(() => expect(name).toHaveFocus());
	});

	it("closes only the question with Esc or a click outside it, once", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		await user.type(nameField(dialog), "Correr");
		await user.keyboard("{Escape}");
		await screen.findByRole("alertdialog");
		expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("dialog", { name: "Novo hábito" })).toBeVisible();
		expect(nameField(dialog)).toHaveValue("Correr");

		await user.keyboard("{Escape}");
		await screen.findByRole("alertdialog");
		await user.click(topOverlay());
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("dialog", { name: "Novo hábito" })).toBeVisible();
		expect(nameField(dialog)).toHaveValue("Correr");
	});

	it("keeps the focus inside the form after a click outside it", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		await user.type(nameField(dialog), "Correr");
		// The click blurs the field before the question opens.
		await user.click(topOverlay());
		await user.click(
			await screen.findByRole("button", { name: "Continuar editando" })
		);
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		await waitFor(() =>
			expect(dialog).toContainElement(document.activeElement as HTMLElement)
		);
	});

	it("discards, and opening again starts from the defaults", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		await user.type(nameField(dialog), "Correr");
		await user.keyboard("{Escape}");
		await user.click(await screen.findByRole("button", { name: "Descartar" }));
		await closed();
		expect(screen.queryByRole("alertdialog")).toBeNull();

		await ENTRIES[0]!.open(user);
		const again = await screen.findByRole("dialog", { name: "Novo hábito" });
		expect(nameField(again)).toHaveValue("");
		await user.keyboard("{Escape}");
		await closed();
	});

	it("never asks after saving", async () => {
		const { user, dialog } = await openForm(ENTRIES[3]!);
		const name = nameField(dialog);
		await user.clear(name);
		await user.type(name, "Ler livros");
		await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
		await closed();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("never asks after creating", async () => {
		const { user, dialog } = await openForm(ENTRIES[1]!);
		await user.type(nameField(dialog), "Correr");
		await user.click(within(dialog).getByRole("button", { name: "Criar" }));
		await closed();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("keeps the form, the data and the question after a failed save", async () => {
		const { routes } = server({ failPatch: true });
		const { user } = renderApp("/today", { routes });
		await ENTRIES[3]!.open(user);
		const dialog = await screen.findByRole("dialog", { name: "Editar hábito" });
		const name = nameField(dialog);
		await user.clear(name);
		await user.type(name, "Ler livros");
		await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
		expect(
			await screen.findByText("Não foi possível salvar o hábito")
		).toBeInTheDocument();
		expect(name).toHaveValue("Ler livros");

		await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
		expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
	});

	it("animates the question only with motion allowed", async () => {
		const { user, dialog } = await openForm(ENTRIES[0]!);
		await user.type(nameField(dialog), "Correr");
		await user.keyboard("{Escape}");
		const alert = await screen.findByRole("alertdialog");
		const animated = [...alert.classList].filter((name) =>
			/animate-|fade-|zoom-/.test(name)
		);
		expect(animated.length).toBeGreaterThan(0);
		for (const name of animated) expect(name).toMatch(/^motion-safe:/);
	});
});
