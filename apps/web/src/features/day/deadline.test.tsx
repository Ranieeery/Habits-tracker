// Deadline tasks (2.13.0) on the web: the form's "Até uma data", today's
// "Com prazo" group (order, badges, marking and undo), nothing on other days,
// "Já concluída em" on a missed due date done later, and "Passados".
// TODAY = Friday 2026-10-09.
import type { DayResponse, Habit } from "@habits/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HabitForm } from "@/features/habits/habit-form.tsx";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	TIME_ZONE,
	TODAY,
} from "@/test/harness.tsx";

const read = habit({ id: "0199c9a0-8888-7000-8000-000000000001", name: "Ler" });
const soon = habit({
	id: "0199c9a0-8888-7000-8000-000000000002",
	name: "Consulta",
	schedule: { type: "deadline", due_date: "2026-10-10" },
	start_date: "2026-10-01",
	sort_key: "a1",
});
const later = habit({
	id: "0199c9a0-8888-7000-8000-000000000003",
	name: "Relatório",
	schedule: { type: "deadline", due_date: "2026-10-16" },
	start_date: "2026-10-01",
	sort_key: "a2",
});
const LATER_NAME = "Relatório, até 16 de outubro, faltam 7 dias";

function today() {
	let completed: string[] = [];
	const puts: boolean[] = [];
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits: [read, soon, later] }),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? "";
			if (date !== TODAY) {
				return json({
					date,
					possible_habits: [read],
					completed_habit_ids: [],
				} satisfies DayResponse);
			}
			const laterDone = completed.includes(later.id);
			return json({
				date,
				possible_habits: laterDone ? [read, later] : [read],
				completed_habit_ids: completed,
				overdue: [],
				deadline: [
					{ habit: soon, due_date: "2026-10-10", completed_today: false },
					{ habit: later, due_date: "2026-10-16", completed_today: laterDone },
				],
			} satisfies DayResponse);
		},
		[`PUT /v1/habits/${later.id}/completions/${TODAY}`]: async (request) => {
			const { completed: value } = (await request.json()) as {
				completed: boolean;
			};
			puts.push(value);
			completed = value
				? [...completed, later.id]
				: completed.filter((id) => id !== later.id);
			return json({ completion: null });
		},
	});
	return { routes, puts };
}

describe("the form", () => {
	it("creates a task due on the chosen date, starting today, without 'Começa em'", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<HabitForm
				today={TODAY}
				timeZone={TIME_ZONE}
				submitLabel="Criar"
				onSubmit={onSubmit}
			/>
		);
		await user.type(screen.getByLabelText("Qual é o hábito?"), "Relatório");
		await user.click(screen.getByRole("radio", { name: "Até uma data" }));
		expect(screen.queryByRole("button", { name: /^Começa em/ })).toBeNull();
		await user.click(screen.getByRole("button", { name: /^Até quando\?/ }));
		await user.click(screen.getByRole("button", { name: "16/10/2026" }));
		expect(
			screen.getByText(
				"Pode ser concluído até 16/10. Se passar do prazo, fica atrasado."
			)
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Criar" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "Relatório",
			description: "",
			schedule: { type: "deadline", due_date: "2026-10-16" },
			start_date: TODAY,
		});
	});

	it("keeps a due date that went by read only", () => {
		render(
			<HabitForm
				initial={habit({
					id: later.id,
					name: "Relatório",
					schedule: { type: "deadline", due_date: "2026-10-05" },
					start_date: "2026-10-01",
				})}
				today={TODAY}
				timeZone={TIME_ZONE}
				submitLabel="Salvar"
				onSubmit={vi.fn()}
			/>
		);
		expect(screen.getByText("Até quando: 05/10/2026")).toBeInTheDocument();
		expect(
			screen.getByText(
				"O prazo já passou. Para mudar, arquive esta tarefa e crie outra."
			)
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Até quando\?/ })).toBeNull();
	});
});

describe("today's 'Com prazo'", () => {
	it("lists open tasks after the day's habits, by due date, with read badges", async () => {
		const { routes } = today();
		renderApp("/today", { routes });

		await screen.findByRole("checkbox", { name: LATER_NAME });
		expect(
			screen
				.getAllByRole("checkbox")
				.map((box) => box.getAttribute("aria-label"))
		).toEqual(["Ler", "Consulta, vence amanhã", LATER_NAME]);
		const group = screen.getByRole("region", { name: "Com prazo" });
		expect(within(group).getByText("Vence amanhã")).toBeInTheDocument();
		expect(
			within(group).getByText("Até 16/10 · faltam 7 dias")
		).toBeInTheDocument();
		// Open tasks not due today are outside the progress.
		expect(screen.getByText("0 de 1 concluídos (0%)")).toBeInTheDocument();
	});

	it("marks a task (the progress grows) and undoes it", async () => {
		const { routes, puts } = today();
		const { user } = renderApp("/today", { routes });

		await user.click(await screen.findByRole("checkbox", { name: LATER_NAME }));
		expect(screen.getByText("1 de 2 concluídos (50%)")).toBeInTheDocument();
		await waitFor(() => expect(puts).toEqual([true]));
		expect(screen.getByRole("checkbox", { name: LATER_NAME })).toBeChecked();

		await user.click(await screen.findByRole("button", { name: "Desfazer" }));
		await waitFor(() => expect(puts).toEqual([true, false]));
		await waitFor(() =>
			expect(screen.getByText("0 de 1 concluídos (0%)")).toBeInTheDocument()
		);
	});

	it("is absent on past and future days", async () => {
		const { routes } = today();
		const past = renderAppOn("2026-10-08", routes);
		expect(
			await screen.findByRole("checkbox", { name: "Ler" })
		).toBeInTheDocument();
		expect(screen.queryByText("Com prazo")).toBeNull();
		past.unmount();
		// A preview day (2.14.0) lists what is planned, without checkboxes.
		renderAppOn("2026-10-10", routes);
		expect(await screen.findByText("Ler")).toBeInTheDocument();
		expect(screen.queryByText("Com prazo")).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});
});

function renderAppOn(date: string, routes: ReturnType<typeof defaultRoutes>) {
	renderApp(`/day/${date}`, { routes });
	return {
		unmount: () => document.body.replaceChildren(),
	};
}

describe("a missed due date done later", () => {
	it("says 'Já concluída em' without an active checkbox", async () => {
		const missed = habit({
			id: later.id,
			name: "Relatório",
			schedule: { type: "deadline", due_date: "2026-10-05" },
			start_date: "2026-10-01",
		});
		const routes = defaultRoutes({
			"GET /v1/day": (request) =>
				json({
					date: new URL(request.url).searchParams.get("date") ?? "",
					possible_habits: [missed],
					completed_habit_ids: [],
					deadline_done: [{ habit_id: missed.id, date: "2026-10-07" }],
				} satisfies DayResponse),
		});
		renderApp("/day/2026-10-05", { routes });

		const box = await screen.findByRole("checkbox", {
			name: "Relatório, já concluída em 7 de outubro",
		});
		expect(box).toBeChecked();
		expect(box).toBeDisabled();
		expect(screen.getByText("Já concluída em 07/10")).toBeInTheDocument();
	});
});

describe("habits screen", () => {
	it("moves a done task to 'Passados' and badges the open one", async () => {
		const done: Habit = habit({
			id: "0199c9a0-8888-7000-8000-000000000004",
			name: "Pagar boleto",
			schedule: { type: "deadline", due_date: "2026-10-20" },
			start_date: "2026-10-01",
			sort_key: "a3",
		});
		const routes = defaultRoutes({
			"GET /v1/habits": () =>
				json({
					habits: [read, later, done],
					deadline_completions: [{ habit_id: done.id, date: "2026-10-08" }],
				}),
		});
		const { user } = renderApp("/habits", { routes });

		const active = await screen.findByRole("list", { name: "Hábitos ativos" });
		await waitFor(() =>
			expect(within(active).queryByText("Pagar boleto")).toBeNull()
		);
		expect(within(active).getByText("Relatório")).toBeInTheDocument();
		expect(
			within(active).getByText("Até 16/10 · faltam 7 dias")
		).toBeInTheDocument();
		await user.click(screen.getByText(/Passados/));
		expect(screen.getByText("Pagar boleto")).toBeInTheDocument();
	});
});
