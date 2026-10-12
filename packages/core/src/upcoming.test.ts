import type { Habit } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { upcoming } from "./upcoming.ts";

const sp = { timeZone: "America/Sao_Paulo" };
const TODAY = "2026-10-11"; // Sunday

function habit(name: string, overrides: Partial<Habit>): Habit {
	return {
		id: name,
		name,
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: TODAY,
		archived_at: null,
		sort_key: "a0",
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

describe("upcoming", () => {
	it("lists the next 14 days of non-weekday habits, by date then the user's order", () => {
		const habits = [
			habit("Ler", {}),
			habit("Consulta", {
				schedule: { type: "once", date: "2026-10-13" },
				start_date: "2026-10-13",
			}),
			habit("Filtro", {
				schedule: { type: "interval", every: 8, anchor_date: "2026-10-13" },
			}),
			habit("Condomínio", { schedule: { type: "monthly_days", days: [20] } }),
			habit("Aniversário", { schedule: { type: "yearly", month: 12, day: 1 } }),
		];
		expect(
			upcoming(habits, TODAY, sp).map((item) => [item.date, item.habit.name])
		).toEqual([
			["2026-10-13", "Consulta"],
			["2026-10-13", "Filtro"],
			["2026-10-20", "Condomínio"],
			["2026-10-21", "Filtro"],
		]);
	});

	it("orders habits of the same date as the user does, not by name", () => {
		const habits = [
			habit("Bravo", {
				schedule: { type: "once", date: "2026-10-13" },
				start_date: "2026-10-13",
				sort_key: "a1",
			}),
			habit("Alfa", {
				schedule: { type: "once", date: "2026-10-13" },
				start_date: "2026-10-13",
				sort_key: "a2",
			}),
		];
		expect(upcoming(habits, TODAY, sp).map((item) => item.habit.name)).toEqual([
			"Bravo",
			"Alfa",
		]);
	});

	it("leaves out today, archived, deleted and unsupported habits", () => {
		const habits = [
			habit("Hoje", { schedule: { type: "once", date: TODAY } }),
			habit("Arquivado", {
				schedule: { type: "monthly_days", days: [12] },
				archived_at: 5,
			}),
			habit("Apagado", {
				schedule: { type: "monthly_days", days: [12] },
				deleted_at: 5,
			}),
			habit("Futuro", { schedule: { type: "lunar" } }),
		];
		expect(upcoming(habits, TODAY, sp)).toEqual([]);
	});

	it("covers a custom number of days", () => {
		const day31 = habit("Fim do mês", {
			schedule: { type: "monthly_days", days: [31] },
		});
		expect(
			upcoming([day31], TODAY, { ...sp, days: 21 }).map((item) => item.date)
		).toEqual(["2026-10-31"]);
	});
});
