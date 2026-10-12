import { describe, expect, it } from "vitest";
import {
	buildFromDraft,
	draftFromHabit,
	emptyDraft,
	type HabitDraft,
	previewHabit,
} from "./habit-draft.ts";

const TODAY = "2026-10-11"; // Sunday
const sp = { timeZone: "America/Sao_Paulo" };

const draft = (changes: Partial<HabitDraft>): HabitDraft => ({
	...emptyDraft(TODAY),
	...changes,
});

describe("buildFromDraft (creating)", () => {
	it("defaults to every weekday starting today", () => {
		expect(buildFromDraft(emptyDraft(TODAY), { today: TODAY })).toEqual({
			ok: true,
			schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
			start_date: TODAY,
		});
	});

	it("builds each kind", () => {
		expect(
			buildFromDraft(
				draft({ kind: "interval", every: "8", start: "2026-10-22" }),
				{
					today: TODAY,
				}
			)
		).toEqual({
			ok: true,
			schedule: { type: "interval", every: 8, anchor_date: "2026-10-22" },
			start_date: "2026-10-22",
		});
		expect(
			buildFromDraft(draft({ kind: "monthly_days", monthDays: [20, 5, 20] }), {
				today: TODAY,
			})
		).toMatchObject({ ok: true, schedule: { days: [5, 20] } });
		expect(
			buildFromDraft(draft({ kind: "once", date: "2026-11-20" }), {
				today: TODAY,
			})
		).toEqual({
			ok: true,
			schedule: { type: "once", date: "2026-11-20" },
			start_date: "2026-11-20",
		});
		expect(
			buildFromDraft(draft({ kind: "yearly", month: 2, day: 29 }), {
				today: TODAY,
			})
		).toMatchObject({ ok: true, schedule: { month: 2, day: 29 } });
	});

	it("explains each problem in pt-BR", () => {
		const errors = (changes: Partial<HabitDraft>) => {
			const result = buildFromDraft(draft(changes), { today: TODAY });
			return result.ok ? {} : result.errors;
		};
		expect(errors({ weekdays: [] })).toEqual({
			weekdays: "Escolha pelo menos um dia da semana.",
		});
		expect(errors({ kind: "interval", every: "0" })).toEqual({
			every: "Use um número de 1 a 366.",
		});
		expect(errors({ kind: "interval", every: "abc" }).every).toBeDefined();
		expect(errors({ kind: "monthly_days", monthDays: [] })).toEqual({
			monthDays: "Escolha pelo menos um dia do mês.",
		});
		expect(errors({ kind: "once", date: "2026-10-10" })).toEqual({
			date: "Escolha hoje ou uma data futura.",
		});
		expect(errors({ kind: "monthly_days", start: "2026-10-01" })).toEqual({
			start: "Escolha hoje ou uma data futura.",
		});
		expect(errors({ kind: "yearly", month: 4, day: 31 })).toEqual({
			day: "Esse dia não existe nesse mês.",
		});
	});
});

describe("editing", () => {
	const consulta = {
		schedule: { type: "once", date: "2026-10-05" } as const,
		start_date: "2026-10-05",
	};

	it("keeps a past date the habit already had", () => {
		const form = draftFromHabit(consulta, TODAY)!;
		expect(form).toMatchObject({ kind: "once", date: "2026-10-05" });
		expect(buildFromDraft(form, { today: TODAY, editing: consulta })).toEqual({
			ok: true,
			schedule: consulta.schedule,
			start_date: "2026-10-05",
		});
	});

	it("refuses moving it to another past date", () => {
		const form = { ...draftFromHabit(consulta, TODAY)!, date: "2026-10-06" };
		expect(buildFromDraft(form, { today: TODAY, editing: consulta })).toEqual({
			ok: false,
			errors: { date: "Escolha hoje ou uma data futura." },
		});
	});

	it("has no form for an unsupported schedule", () => {
		expect(
			draftFromHabit({ schedule: { type: "lunar" }, start_date: TODAY }, TODAY)
		).toBeNull();
	});
});

describe("previewHabit", () => {
	it("shows the summary and the next occurrence", () => {
		expect(
			previewHabit(
				{
					schedule: { type: "interval", every: 8, anchor_date: "2026-10-22" },
					start_date: "2026-10-22",
				},
				TODAY,
				sp
			)
		).toEqual({
			summary: "Repete a cada 8 dias, a partir de 22/10",
			next: "Próxima: qui, 22/10",
		});
		expect(
			previewHabit(
				{ schedule: { type: "monthly_days", days: [11] }, start_date: TODAY },
				TODAY,
				sp
			).next
		).toBe("Próxima: hoje");
	});
});
