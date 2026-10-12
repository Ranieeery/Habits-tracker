import { describe, expect, it } from "vitest";
import type { SchedulableHabit } from "./schedule.ts";
import {
	formatDayMonth,
	formatRelativeDate,
	formatSchedule,
	formatWeekdays,
	listWeekdays,
	newHabitNotice,
	repeatSummary,
	UNSUPPORTED_SCHEDULE_TEXT,
	WEEKDAY_SHORT_NAMES,
} from "./schedule-text.ts";

const sp = { timeZone: "America/Sao_Paulo" };
// 2026-10-09 is a Friday (weekday 5).
const FRIDAY = "2026-10-09";

function habit(days: number[]): SchedulableHabit {
	return {
		schedule: { type: "weekdays", days },
		start_date: FRIDAY,
		archived_at: null,
		deleted_at: null,
	};
}

describe("listWeekdays", () => {
	it("lists short names Sunday first, without duplicates", () => {
		expect(listWeekdays([5, 1, 3, 1])).toBe("seg, qua, sex");
		expect(listWeekdays([6, 0])).toBe("dom, sáb");
		expect(listWeekdays([])).toBe("");
		expect(WEEKDAY_SHORT_NAMES).toHaveLength(7);
	});

	it("ignores values outside 0-6", () => {
		expect(listWeekdays([7, -1, 2])).toBe("ter");
	});
});

describe("formatWeekdays", () => {
	it("names the common sets and lists the rest", () => {
		expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
		expect(formatWeekdays([5, 1, 2, 3, 4])).toBe("Dias úteis");
		expect(formatWeekdays([6, 0])).toBe("Fins de semana");
		expect(formatWeekdays([5, 1, 3])).toBe("seg, qua, sex");
		expect(formatWeekdays([3, 3, 1])).toBe("seg, qua");
	});
});

describe("newHabitNotice", () => {
	it("is null when the habit counts today", () => {
		expect(newHabitNotice(habit([5]), FRIDAY, sp)).toBeNull();
		expect(newHabitNotice(habit([0, 1, 2, 3, 4, 5, 6]), FRIDAY, sp)).toBeNull();
	});

	it("says on which days it shows up when today is not one of them", () => {
		expect(newHabitNotice(habit([3, 1]), FRIDAY, sp)).toBe(
			"Hábito criado. Aparece em: seg, qua"
		);
		// Weekdays only, created on a Saturday: listed day by day, not "Dias úteis".
		expect(newHabitNotice(habit([1, 2, 3, 4, 5]), "2026-10-10", sp)).toBe(
			"Hábito criado. Aparece em: seg, ter, qua, qui, sex"
		);
	});

	it("explains a habit that starts after today", () => {
		const later = { ...habit([5]), start_date: "2026-10-16" };
		expect(newHabitNotice(later, FRIDAY, sp)).toBe(
			"Hábito criado. Aparece em: sex"
		);
	});
});

describe("formatSchedule", () => {
	it("names every schedule type in pt-BR", () => {
		expect(formatSchedule({ type: "weekdays", days: [1, 2, 3, 4, 5] })).toBe(
			"Dias úteis"
		);
		expect(
			formatSchedule({ type: "interval", every: 8, anchor_date: FRIDAY })
		).toBe("A cada 8 dias");
		expect(
			formatSchedule({ type: "interval", every: 1, anchor_date: FRIDAY })
		).toBe("Todos os dias");
		expect(formatSchedule({ type: "monthly_days", days: [20] })).toBe(
			"Todo dia 20"
		);
		expect(formatSchedule({ type: "monthly_days", days: [20, 5] })).toBe(
			"Todo dia 5 e 20"
		);
		expect(formatSchedule({ type: "monthly_days", days: [30, 1, 15] })).toBe(
			"Todo dia 1, 15 e 30"
		);
		expect(formatSchedule({ type: "yearly", month: 11, day: 20 })).toBe(
			"Todo ano em 20/11"
		);
		expect(formatSchedule({ type: "yearly", month: 2, day: 29 })).toBe(
			"Todo ano em 29/02 (28/02 em anos não bissextos)"
		);
		expect(formatSchedule({ type: "once", date: "2026-11-20" })).toBe(
			"Dia 20/11"
		);
	});

	it("shows the year of a single date only when it is not this year", () => {
		const once = { type: "once", date: "2027-01-05" } as const;
		expect(formatSchedule(once, { today: "2027-01-01" })).toBe("Dia 05/01");
		expect(formatSchedule(once, { today: FRIDAY })).toBe("Dia 05/01/2027");
	});

	it("does not break on a schedule from a newer version", () => {
		expect(formatSchedule({ type: "lunar" })).toBe(UNSUPPORTED_SCHEDULE_TEXT);
	});
});

describe("formatRelativeDate and formatDayMonth", () => {
	it("says hoje, amanhã, or the weekday and date", () => {
		expect(formatRelativeDate(FRIDAY, FRIDAY)).toBe("hoje");
		expect(formatRelativeDate("2026-10-10", FRIDAY)).toBe("amanhã");
		expect(formatRelativeDate("2026-11-20", FRIDAY)).toBe("sex, 20/11");
		expect(formatRelativeDate("2027-01-04", "2026-12-31")).toBe(
			"seg, 04/01/2027"
		);
		expect(formatDayMonth("2026-03-07")).toBe("07/03");
	});
});

describe("repeatSummary", () => {
	it("describes the repetition and a future start", () => {
		expect(
			repeatSummary(
				{
					schedule: { type: "interval", every: 8, anchor_date: "2026-10-22" },
					start_date: "2026-10-22",
				},
				FRIDAY
			)
		).toBe("Repete a cada 8 dias, a partir de 22/10");
		expect(
			repeatSummary(
				{ schedule: { type: "weekdays", days: [1, 3] }, start_date: FRIDAY },
				FRIDAY
			)
		).toBe("Repete em seg, qua");
		expect(
			repeatSummary(
				{ schedule: { type: "monthly_days", days: [20] }, start_date: FRIDAY },
				FRIDAY
			)
		).toBe("Repete todo dia 20");
		expect(
			repeatSummary(
				{
					schedule: { type: "once", date: "2026-11-20" },
					start_date: "2026-11-20",
				},
				FRIDAY
			)
		).toBe("Uma vez, dia 20/11");
	});
});

describe("newHabitNotice for the new schedules", () => {
	it("tells when a habit not happening today comes next", () => {
		const consulta: SchedulableHabit = {
			schedule: { type: "once", date: "2026-11-20" },
			start_date: "2026-11-20",
			archived_at: null,
			deleted_at: null,
		};
		expect(newHabitNotice(consulta, FRIDAY, sp)).toBe(
			"Hábito criado. Próxima vez: sex, 20/11"
		);
		const today: SchedulableHabit = {
			...consulta,
			schedule: { type: "once", date: FRIDAY },
			start_date: FRIDAY,
		};
		expect(newHabitNotice(today, FRIDAY, sp)).toBeNull();
	});
});
