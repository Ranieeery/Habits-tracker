import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TIME_ZONE, TODAY } from "@/test/harness.tsx";
import { HabitForm, type HabitFormInitial } from "./habit-form.tsx";

// TODAY = 2026-10-09, a Friday.
function setup(initial?: HabitFormInitial) {
	const onSubmit = vi.fn();
	const user = userEvent.setup();
	render(
		<HabitForm
			initial={initial}
			today={TODAY}
			timeZone={TIME_ZONE}
			submitLabel={initial ? "Salvar" : "Criar"}
			onSubmit={onSubmit}
		/>
	);
	return { onSubmit, user };
}

const nameField = () => screen.getByLabelText("Qual é o hábito?");
const submit = () =>
	screen.getByRole("button", { name: /^(Criar|Salvar|Salvar mesmo assim)$/ });
const kind = (label: string) => screen.getByRole("radio", { name: label });
const dateButton = (label: string) =>
	screen.getByRole("button", { name: new RegExp(`^${label}`) });

/** Opens the calendar of a date field, moves `months` ahead and picks a day. */
async function pickDate(
	user: ReturnType<typeof userEvent.setup>,
	label: string,
	day: string,
	months = 0
) {
	await user.click(dateButton(label));
	for (let i = 0; i < months; i++) {
		await user.click(screen.getByRole("button", { name: "Próximo mês" }));
	}
	await user.click(screen.getByRole("button", { name: day }));
}

describe("HabitForm: weekdays (default)", () => {
	it("offers the seven weekdays from Sunday to Saturday, all selected", () => {
		setup();
		expect(kind("Dias da semana")).toHaveAttribute("aria-checked", "true");
		const days = screen.getAllByRole("button", { pressed: true });
		expect(days.map((day) => day.getAttribute("aria-label"))).toEqual([
			"domingo",
			"segunda-feira",
			"terça-feira",
			"quarta-feira",
			"quinta-feira",
			"sexta-feira",
			"sábado",
		]);
		expect(days.map((day) => day.textContent)).toEqual([
			"D",
			"S",
			"T",
			"Q",
			"Q",
			"S",
			"S",
		]);
	});

	it("submits the name, the chosen days sorted and the start", async () => {
		const { onSubmit, user } = setup();
		await user.type(nameField(), "  Meditar ");
		for (const day of [
			"terça-feira",
			"quinta-feira",
			"sexta-feira",
			"sábado",
		]) {
			await user.click(screen.getByRole("button", { name: day }));
		}
		await user.click(submit());

		expect(onSubmit).toHaveBeenCalledWith({
			name: "Meditar",
			schedule: { type: "weekdays", days: [0, 1, 3] },
			start_date: TODAY,
		});
	});

	it("requires a name and at least one day", async () => {
		const { onSubmit, user } = setup();
		for (const day of screen.getAllByRole("button", { pressed: true })) {
			await user.click(day);
		}
		await user.click(submit());

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText("Dê um nome ao hábito.")).toBeInTheDocument();
		expect(
			screen.getByText("Escolha pelo menos um dia da semana.")
		).toBeInTheDocument();
		expect(nameField()).toHaveAttribute("aria-invalid", "true");
	});

	it("prefills name and days when editing", () => {
		setup({
			name: "Correr",
			schedule: { type: "weekdays", days: [2, 4] },
			start_date: TODAY,
		});
		expect(nameField()).toHaveValue("Correr");
		const pressed = screen.getAllByRole("button", { pressed: true });
		expect(pressed.map((day) => day.getAttribute("aria-label"))).toEqual([
			"terça-feira",
			"quinta-feira",
		]);
	});
});

describe("HabitForm: other repetitions", () => {
	it("every N days, with a summary and the next date before saving", async () => {
		const { onSubmit, user } = setup();
		await user.type(nameField(), "Trocar filtro");
		await user.click(kind("A cada N dias"));
		const every = screen.getByLabelText("A cada quantos dias?");
		await user.clear(every);
		await user.type(every, "8");
		await pickDate(user, "Começa em", "22/10/2026");
		// pt-BR order (day first), never the browser's locale.
		expect(dateButton("Começa em")).toHaveTextContent("22/10/2026");

		expect(
			screen.getByText("Repete a cada 8 dias, a partir de 22/10")
		).toBeInTheDocument();
		expect(screen.getByText("Próxima: qui, 22/10")).toBeInTheDocument();

		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Trocar filtro",
			schedule: { type: "interval", every: 8, anchor_date: "2026-10-22" },
			start_date: "2026-10-22",
		});
	});

	it("days of the month", async () => {
		const { onSubmit, user } = setup();
		await user.type(nameField(), "Pagar condomínio");
		await user.click(kind("Dias do mês"));
		// Today (9th) is preselected; pick the 20th instead.
		await user.click(screen.getByRole("button", { name: "Dia 9" }));
		await user.click(screen.getByRole("button", { name: "Dia 20" }));
		expect(screen.getByText("Repete todo dia 20")).toBeInTheDocument();

		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Pagar condomínio",
			schedule: { type: "monthly_days", days: [20] },
			start_date: TODAY,
		});
	});

	it("a single date: past days cannot be picked", async () => {
		const { onSubmit, user } = setup();
		await user.type(nameField(), "Consulta no dermatologista");
		await user.click(kind("Uma data"));
		expect(
			screen.queryByRole("button", { name: /^Começa em/ })
		).not.toBeInTheDocument();
		expect(dateButton("Em qual data?")).toHaveTextContent("09/10/2026");

		await user.click(dateButton("Em qual data?"));
		expect(screen.getByRole("button", { name: "01/10/2026" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Mês anterior" })).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Próximo mês" }));
		expect(screen.getByText("novembro de 2026")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "20/11/2026" }));
		expect(dateButton("Em qual data?")).toHaveTextContent("20/11/2026");

		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Consulta no dermatologista",
			schedule: { type: "once", date: "2026-11-20" },
			start_date: "2026-11-20",
		});
	});

	it("every year, explaining February 29", async () => {
		const { onSubmit, user } = setup();
		await user.type(nameField(), "Aniversário");
		await user.click(kind("Todo ano"));
		await user.selectOptions(screen.getByLabelText("Dia"), "29");
		await user.selectOptions(screen.getByLabelText("Mês"), "fevereiro");
		expect(
			screen.getByText("Em anos não bissextos, vale 28/02.")
		).toBeInTheDocument();

		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Aniversário",
			schedule: { type: "yearly", month: 2, day: 29 },
			start_date: TODAY,
		});
	});
});

describe("HabitForm: editing", () => {
	it("asks before changing the repetition of a habit that already started", async () => {
		const { onSubmit, user } = setup({
			name: "Correr",
			schedule: { type: "weekdays", days: [2, 4] },
			start_date: "2026-09-01",
		});
		await user.click(screen.getByRole("button", { name: "sábado" }));
		await user.click(submit());

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Mudar a repetição recalcula os dias passados do heatmap."
		);
		await user.click(
			screen.getByRole("button", { name: "Salvar mesmo assim" })
		);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				schedule: { type: "weekdays", days: [2, 4, 6] },
			})
		);
	});

	it("does not ask when only the name changes", async () => {
		const { onSubmit, user } = setup({
			name: "Correr",
			schedule: { type: "weekdays", days: [2, 4] },
			start_date: "2026-09-01",
		});
		await user.type(nameField(), " 5 km");
		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Correr 5 km" })
		);
	});

	it("only renames a habit whose repetition this version does not know", async () => {
		const { onSubmit, user } = setup({
			name: "Lua cheia",
			schedule: { type: "lunar" },
			start_date: "2026-09-01",
		});
		expect(
			screen.getByText(/Repetição não suportada nesta versão/)
		).toBeInTheDocument();
		expect(screen.queryByRole("radio")).not.toBeInTheDocument();
		await user.click(submit());
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Lua cheia",
			start_date: "2026-09-01",
		});
	});
});
