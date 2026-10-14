import type { Mutation } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "../local/store.ts";
import { DEPENDENCY_FAILED_CODE } from "./engine.ts";
import {
	describeFailures,
	describeMutation,
	failureReason,
	habitNames,
} from "./failures.ts";

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
				{ ...base, type: "habit.delete", habit_id: HABIT },
				names
			)
		).toBe("Apagar “Ler”");
		expect(
			describeMutation({ ...base, type: "habit.restore", habit_id: "x" }, names)
		).toBe("Restaurar “hábito removido”");
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
				reason: "Fora do período editável (até 30 dias atrás).",
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

describe("failureReason", () => {
	it("names the earliest date the server accepted", () => {
		// A completion refused by an API with a 7-day window (before 2.3.0).
		expect(
			failureReason({
				code: "date_out_of_range",
				details: { from: "2026-10-02", to: "2026-10-10" },
			})
		).toBe("Fora do período editável (a partir de 02/10).");
		// A habit creation refused for its start date.
		expect(
			failureReason({
				code: "date_out_of_range",
				details: { earliest: "2026-09-09" },
			})
		).toBe("Fora do período editável (a partir de 09/09).");
	});

	it("falls back to the window size or a generic message", () => {
		expect(failureReason({ code: "date_out_of_range" })).toBe(
			"Fora do período editável (até 30 dias atrás)."
		);
		expect(
			failureReason({ code: "date_out_of_range", details: { from: "x" } })
		).toBe("Fora do período editável (até 30 dias atrás).");
		expect(failureReason({ code: "not_found" })).toBe(
			"O hábito não existe mais."
		);
		expect(failureReason(null)).toBe("O servidor recusou a alteração.");
	});
});

describe("postponements (2.16.0)", () => {
	const create: Mutation = {
		mutation_id: "00000000-0000-7000-8000-0000000000a1",
		created_at: 1,
		type: "reschedule.create",
		id: "00000000-0000-7000-8000-0000000000b1",
		habit_id: HABIT,
		original_date: "2026-10-09",
		from_date: "2026-10-09",
		to_date: "2026-10-16",
		sequence: 1,
		action_date: "2026-10-09",
	};

	it("names the change and says why in core's words", () => {
		expect(describeMutation(create, names)).toBe(
			"Adiar “Ler” de 09/10 para 16/10"
		);
		expect(
			describeMutation(
				{
					mutation_id: "00000000-0000-7000-8000-0000000000a2",
					created_at: 1,
					type: "reschedule.undo",
					habit_id: HABIT,
					reschedule_id: "00000000-0000-7000-8000-0000000000b1",
					action_date: "2026-10-09",
				},
				names
			)
		).toBe("Desfazer o adiamento de “Ler”");
		expect(
			failureReason({ code: "conflict", details: { reason: "limit_reached" } })
		).toBe("Limite de 2 adiamentos atingido");
		expect(
			failureReason({ code: "conflict", details: { reason: "stale" } })
		).toBe("A ocorrência mudou em outro aparelho.");
		// Other reasons keep their old text.
		expect(
			failureReason({
				code: "validation_error",
				details: { reason: "deadline_passed" },
			})
		).toBe("Os dados da alteração são inválidos.");
	});
});
