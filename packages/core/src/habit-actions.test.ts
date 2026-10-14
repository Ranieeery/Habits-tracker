import { describe, expect, it } from "vitest";
import {
	HABIT_ACTIONS,
	habitActions,
	habitMenuLabel,
} from "./habit-actions.ts";

const ids = (habit: Parameters<typeof habitActions>[0]) =>
	habitActions(habit).map((action) => action.id);

describe("habit actions", () => {
	it("keeps one ordered list with every label", () => {
		expect(HABIT_ACTIONS.map((action) => [action.id, action.label])).toEqual([
			["edit", "Editar hábito"],
			["reschedule", "Adiar"],
			["description", "Ver descrição completa"],
			["archive", "Arquivar"],
			["unarchive", "Desarquivar"],
		]);
		expect(HABIT_ACTIONS[0]?.hint).toBe("Vale para todos os dias");
	});

	it("offers the description only when there is one", () => {
		expect(ids({ archived_at: null, description: "Ler 10 páginas" })).toEqual([
			"edit",
			"description",
			"archive",
		]);
		expect(ids({ archived_at: null, description: "  \n " })).toEqual([
			"edit",
			"archive",
		]);
		expect(ids({ archived_at: null })).toEqual(["edit", "archive"]);
	});

	it("swaps archive for unarchive on an archived habit", () => {
		expect(ids({ archived_at: 1_700_000_000_000, description: "" })).toEqual([
			"edit",
			"unarchive",
		]);
	});

	it("marks archiving as careful", () => {
		const archive = habitActions({ archived_at: null }).find(
			(action) => action.id === "archive"
		);
		expect(archive?.careful).toBe(true);
	});

	it("names the button after the habit", () => {
		expect(habitMenuLabel("Ler")).toBe("Mais opções de Ler");
	});
});
