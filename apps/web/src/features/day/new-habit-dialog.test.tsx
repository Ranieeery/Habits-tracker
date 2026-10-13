import {
	CreateHabitRequest,
	type DayResponse,
	type Habit,
} from "@habits/contracts";
import { isHabitPossibleOn } from "@habits/core";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	NOW,
	renderApp,
	TIME_ZONE,
	TODAY,
} from "@/test/harness.tsx";

// TODAY (2026-10-09) is a Friday.
const NEW_ID = "0199c9a0-2222-7000-8000-000000000001";
const water = habit({
	id: "0199c9a0-1111-7000-8000-000000000001",
	name: "Beber água",
});

/** A promise the test resolves by hand, to look at the in-flight state. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

/**
 * A tiny server: the day lists the habits possible on it (core's rule), and
 * POST /v1/habits stores the habit (idempotent by id, like the API). `post`
 * can delay the answer or replace it.
 */
function server(
	initial: Habit[],
	post?: (request: Request) => Promise<Response | undefined> | undefined
) {
	const habits = [...initial];
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits }),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? TODAY;
			return json({
				date,
				possible_habits: habits.filter((item) =>
					isHabitPossibleOn(item, date, { timeZone: TIME_ZONE })
				),
				completed_habit_ids: [],
			} satisfies DayResponse);
		},
		"POST /v1/habits": async (request) => {
			const custom = await post?.(request.clone());
			if (custom) return custom;
			const body = CreateHabitRequest.parse(await request.json());
			const existing = habits.find((item) => item.id === body.id);
			if (existing) return json({ habit: existing });
			const created = habit({
				id: body.id ?? NEW_ID,
				name: body.name,
				schedule: body.schedule,
				start_date: body.start_date,
				created_at: NOW,
				updated_at: NOW,
			});
			habits.push(created);
			return json({ habit: created }, 201);
		},
	});
	return { routes, habits };
}

const posts = (requests: Request[]) =>
	requests.filter((request) => request.method === "POST");

type User = ReturnType<typeof renderApp>["user"];

async function openDialog(user: User) {
	await user.click(await screen.findByRole("button", { name: "Novo hábito" }));
	return screen.findByRole("dialog", { name: "Novo hábito" });
}

const nameInput = (dialog: HTMLElement) =>
	within(dialog).getByLabelText("Qual é o hábito?");

describe("new habit from today's view", () => {
	it("opens with the name focused and every day selected, and gives the focus back on close", async () => {
		const { routes } = server([water]);
		const { user } = renderApp("/today", { routes, ids: [NEW_ID] });

		const dialog = await openDialog(user);
		expect(nameInput(dialog)).toHaveFocus();
		expect(
			within(dialog).getAllByRole("button", { pressed: true })
		).toHaveLength(7);

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		const button = screen.getByRole("button", { name: "Novo hábito" });
		await waitFor(() => expect(button).toHaveFocus());

		await openDialog(user);
		await user.click(screen.getByRole("button", { name: "Fechar" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		await waitFor(() => expect(button).toHaveFocus());
	});

	it("validates the name and the days without sending anything", async () => {
		const { routes } = server([water]);
		const { user, requests } = renderApp("/today", { routes });

		const dialog = await openDialog(user);
		const create = within(dialog).getByRole("button", { name: "Criar" });

		await user.click(create);
		expect(
			await within(dialog).findByText("Dê um nome ao hábito.")
		).toBeInTheDocument();

		await user.type(nameInput(dialog), "   ");
		await user.click(create);
		expect(
			within(dialog).getByText("Dê um nome ao hábito.")
		).toBeInTheDocument();

		for (const day of within(dialog).getAllByRole("button", {
			pressed: true,
		})) {
			await user.click(day);
		}
		await user.click(create);
		expect(
			within(dialog).getByText("Escolha pelo menos um dia da semana.")
		).toBeInTheDocument();
		expect(posts(requests)).toHaveLength(0);
	});

	it("creates a habit for today: it joins the list unchecked", async () => {
		const { routes } = server([water]);
		const { user, requests } = renderApp("/today", {
			routes,
			ids: [NEW_ID],
		});

		const dialog = await openDialog(user);
		await user.type(nameInput(dialog), "  Meditar  {Enter}");

		expect(
			await screen.findByRole("checkbox", { name: "Meditar" })
		).not.toBeChecked();
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(screen.getByText("0 de 2 concluídos (0%)")).toBeInTheDocument();

		const [post] = posts(requests);
		expect(await post?.json()).toEqual({
			id: NEW_ID,
			name: "Meditar",
			description: "",
			schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
			start_date: TODAY,
		});
	});

	it("says on which days a habit shows up when today is not one of them", async () => {
		const { routes, habits } = server([water]);
		const { user } = renderApp("/today", { routes, ids: [NEW_ID] });

		const dialog = await openDialog(user);
		await user.type(nameInput(dialog), "Ler");
		for (const name of [
			"domingo",
			"terça-feira",
			"quinta-feira",
			"sexta-feira",
			"sábado",
		]) {
			await user.click(within(dialog).getByRole("button", { name }));
		}
		await user.click(within(dialog).getByRole("button", { name: "Criar" }));

		expect(
			await screen.findByText("Hábito criado. Aparece em: seg, qua")
		).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(habits.map((item) => item.name)).toEqual(["Beber água", "Ler"]);
		expect(
			screen.queryByRole("checkbox", { name: "Ler" })
		).not.toBeInTheDocument();
	});

	it("is not offered on other days", async () => {
		const { routes } = server([water]);
		renderApp("/day/2026-10-08", { routes });

		expect(
			await screen.findByRole("checkbox", { name: "Beber água" })
		).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Novo hábito" })
		).not.toBeInTheDocument();
	});

	it("is the main action of today's empty state", async () => {
		const { routes } = server([]);
		const { user } = renderApp("/today", { routes, ids: [NEW_ID] });

		expect(await screen.findByText("Nenhum hábito ainda")).toBeInTheDocument();
		const dialog = await openDialog(user);
		await user.type(nameInput(dialog), "Correr{Enter}");
		expect(
			await screen.findByRole("checkbox", { name: "Correr" })
		).not.toBeChecked();
	});

	it("sends once when submitted twice", async () => {
		const answer = deferred<Response | undefined>();
		const { routes } = server([water], () => answer.promise);
		const { user, requests } = renderApp("/today", {
			routes,
			ids: [NEW_ID],
		});

		const dialog = await openDialog(user);
		await user.type(nameInput(dialog), "Ler");
		const form = nameInput(dialog).closest("form");
		if (!form) throw new Error("form not found");
		fireEvent.submit(form);
		fireEvent.submit(form);

		expect(
			await within(dialog).findByRole("button", { name: "Salvando…" })
		).toBeDisabled();
		answer.resolve(undefined);
		await screen.findByRole("checkbox", { name: "Ler" });
		expect(posts(requests)).toHaveLength(1);
	});

	it("keeps what was typed and explains a network failure", async () => {
		const { routes } = server([water], () => {
			throw new TypeError("Failed to fetch");
		});
		const { user } = renderApp("/today", { routes, ids: [NEW_ID] });

		const dialog = await openDialog(user);
		await user.type(nameInput(dialog), "Meditar{Enter}");

		expect(
			await within(dialog).findByText(/Sem conexão com o servidor/)
		).toBeInTheDocument();
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(nameInput(dialog)).toHaveValue("Meditar");
		// The optimistic item was rolled back.
		expect(
			screen.queryByRole("checkbox", { name: "Meditar" })
		).not.toBeInTheDocument();
	});
});
