// How a mutation the server refused is shown in the failures list (pt-BR).
import type { Mutation } from "@habits/contracts";
import { formatShortDate } from "@/lib/format.ts";
import type { OutboxEntry } from "../local/store.ts";
import { DEPENDENCY_FAILED_CODE } from "./engine.ts";

export interface FailureView {
	mutationId: string;
	/** What the change was: "Marcar “Ler” como feito em 09/10". */
	action: string;
	/** Why it was refused. */
	reason: string;
	/** Other failed entries that only failed because of this one. */
	dependents: string[];
}

const REASONS: Record<string, string> = {
	date_out_of_range: "Fora do período editável (até 7 dias atrás).",
	not_found: "O hábito não existe mais.",
	conflict: "Já existe outro registro com o mesmo identificador.",
	validation_error: "Os dados da alteração são inválidos.",
	[DEPENDENCY_FAILED_CODE]: "Depende de um hábito que não foi salvo.",
};

export function failureReason(code: string | undefined): string {
	return (code && REASONS[code]) ?? "O servidor recusou a alteração.";
}

/** Names of every habit the failures may mention, failed creations included. */
export function habitNames(
	habits: readonly { id: string; name: string }[],
	entries: readonly OutboxEntry[]
): Map<string, string> {
	const names = new Map(habits.map((habit) => [habit.id, habit.name]));
	for (const { mutation } of entries) {
		if (mutation.type === "habit.create" && !names.has(mutation.id)) {
			names.set(mutation.id, mutation.name);
		}
	}
	return names;
}

export function describeMutation(
	mutation: Mutation,
	names: ReadonlyMap<string, string>
): string {
	const nameOf = (id: string) => `“${names.get(id) ?? "hábito removido"}”`;
	switch (mutation.type) {
		case "habit.create":
			return `Criar o hábito “${mutation.name}”`;
		case "habit.update": {
			const { name, schedule, archived } = mutation.changes;
			const habit = nameOf(mutation.habit_id);
			if (name !== undefined) return `Renomear ${habit} para “${name}”`;
			if (archived === true) return `Arquivar ${habit}`;
			if (archived === false) return `Desarquivar ${habit}`;
			if (schedule !== undefined) return `Mudar os dias de ${habit}`;
			return `Editar ${habit}`;
		}
		case "completion.set":
			return `${mutation.completed ? "Marcar" : "Desmarcar"} ${nameOf(mutation.habit_id)} em ${formatShortDate(mutation.date)}`;
		default: {
			const unknown: never = mutation;
			return String(unknown);
		}
	}
}

/** The failed entries, oldest first, each with what depends on it. */
export function describeFailures(
	entries: readonly OutboxEntry[],
	names: ReadonlyMap<string, string>
): FailureView[] {
	const failed = entries.filter((entry) => entry.state === "failed");
	return failed.map((entry) => ({
		mutationId: entry.mutation.mutation_id,
		action: describeMutation(entry.mutation, names),
		reason: failureReason(entry.lastError?.code),
		dependents: failed
			.filter((other) => {
				const details = other.lastError?.details as
					{ mutation_id?: string } | undefined;
				return (
					other.lastError?.code === DEPENDENCY_FAILED_CODE &&
					details?.mutation_id === entry.mutation.mutation_id
				);
			})
			.map((other) => other.mutation.mutation_id),
	}));
}
