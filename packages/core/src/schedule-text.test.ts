import { describe, expect, it } from "vitest";
import type { SchedulableHabit } from "./schedule.ts";
import {
	formatWeekdays,
	listWeekdays,
	newHabitNotice,
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
