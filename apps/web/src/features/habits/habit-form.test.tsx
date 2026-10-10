import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HabitForm } from "./habit-form.tsx";

function setup(initial?: Parameters<typeof HabitForm>[0]["initial"]) {
	const onSubmit = vi.fn();
	const user = userEvent.setup();
	render(
		<HabitForm initial={initial} submitLabel="Criar" onSubmit={onSubmit} />
	);
	return { onSubmit, user };
}

describe("HabitForm", () => {
	it("offers the seven weekdays from Sunday to Saturday", () => {
		setup();
		const days = screen.getAllByRole("button", { pressed: false });
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

	it("submits the name and the chosen days sorted, Sunday = 0", async () => {
		const { onSubmit, user } = setup();
		await user.type(screen.getByLabelText("Qual é o hábito?"), "  Meditar ");
		await user.click(screen.getByRole("button", { name: "quarta-feira" }));
		await user.click(screen.getByRole("button", { name: "domingo" }));
		await user.click(screen.getByRole("button", { name: "segunda-feira" }));
		expect(screen.getByRole("button", { name: "domingo" })).toHaveAttribute(
			"aria-pressed",
			"true"
		);

		await user.click(screen.getByRole("button", { name: "Criar" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "Meditar",
			schedule: { type: "weekdays", days: [0, 1, 3] },
		});
	});

	it("toggles a day off again", async () => {
		const { onSubmit, user } = setup();
		await user.type(screen.getByLabelText("Qual é o hábito?"), "Ler");
		await user.click(screen.getByRole("button", { name: "sábado" }));
		await user.click(screen.getByRole("button", { name: "sexta-feira" }));
		await user.click(screen.getByRole("button", { name: "sábado" }));
		await user.click(screen.getByRole("button", { name: "Criar" }));
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Ler",
			schedule: { type: "weekdays", days: [5] },
		});
	});

	it("requires a name and at least one day", async () => {
		const { onSubmit, user } = setup();
		await user.click(screen.getByRole("button", { name: "Criar" }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText("Dê um nome ao hábito.")).toBeInTheDocument();
		expect(
			screen.getByText("Escolha pelo menos um dia da semana.")
		).toBeInTheDocument();
		expect(screen.getByLabelText("Qual é o hábito?")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
	});

	it("prefills name and days when editing", () => {
		setup({ name: "Correr", schedule: { type: "weekdays", days: [2, 4] } });
		expect(screen.getByLabelText("Qual é o hábito?")).toHaveValue("Correr");
		const pressed = screen.getAllByRole("button", { pressed: true });
		expect(pressed.map((day) => day.getAttribute("aria-label"))).toEqual([
			"terça-feira",
			"quinta-feira",
		]);
	});
});
