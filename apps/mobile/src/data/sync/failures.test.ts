import type { Mutation } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "../local/store.ts";
import { DEPENDENCY_FAILED_CODE } from "./engine.ts";
import { describeFailures, describeMutation, habitNames } from "./failures.ts";

const HABIT = "00000000-0000-7000-8000-000000000001";
const NEW_HABIT = "00000000-0000-7000-8000-000000000002";
const names = new Map([[HABIT, "Ler"]]);

function entry(
	mutation: Mutation,
	code: string | null,
	details?: unknown
): OutboxEntry {
	return {
		seq: 1,
		mutation,
		state: code ? "failed" : "pending",
		attempts: 1,
		lastError: code ? { code, message: "", details } : null,
		createdAt: 1,
	};
}

const base = {
	mutation_id: "00000000-0000-7000-8000-0000000000aa",
	created_at: 1,
};

describe("describeMutation", () => {
	it("says what the change was, in Portuguese", () => {
		expect(
			describeMutation(
				{
					...base,
					type: "completion.set",
					id: HABIT,
					habit_id: HABIT,
					date: "2026-10-03",
					completed: true,
				},
				names
			)
		).toBe("Marcar “Ler” em 03/10");
		expect(
			describeMutation(
				{
					...base,
					type: "habit.update",
					habit_id: HABIT,
					changes: { archived: true },
				},
				names
			)
		).toBe("Arquivar “Ler”");
		expect(
			describeMutation(
				{
					...base,
					type: "habit.update",
					habit_id: "x",
					changes: { name: "Y" },
				},
				names
			)
		).toBe("Renomear “hábito removido” para “Y”");
	});
});

describe("describeFailures", () => {
	it("explains each failure and groups the changes that depend on it", () => {
		const create = entry(
			{
				...base,
				type: "habit.create",
				id: NEW_HABIT,
				name: "Correr",
				schedule: { type: "weekdays", days: [1] },
				start_date: "2026-09-01",
			},
			"date_out_of_range"
		);
		const dependent = entry(
			{
				mutation_id: "00000000-0000-7000-8000-0000000000bb",
				created_at: 1,
				type: "completion.set",
				id: HABIT,
				habit_id: NEW_HABIT,
				date: "2026-10-09",
				completed: true,
			},
			DEPENDENCY_FAILED_CODE,
			{ mutation_id: base.mutation_id }
		);
		const entries = [create, dependent];
		const views = describeFailures(entries, habitNames([], entries));
		expect(views).toEqual([
			{
				mutationId: base.mutation_id,
				action: "Criar o hábito “Correr”",
				reason: "Fora do período editável (até 7 dias atrás).",
				dependents: [dependent.mutation.mutation_id],
			},
			{
				mutationId: dependent.mutation.mutation_id,
				action: "Marcar “Correr” em 09/10",
				reason: "Depende de um hábito que não foi salvo.",
				dependents: [],
			},
		]);
	});
});
