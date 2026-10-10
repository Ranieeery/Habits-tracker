import { describe, expect, it } from "vitest";
import {
	formatFullDate,
	formatLongDate,
	formatPercent,
	formatShortDate,
	formatWeekdays,
	monthShortName,
	pluralHabits,
	weekdayInitial,
	weekdayName,
} from "./format.ts";

describe("pt-BR formatting", () => {
	it("formats calendar dates without shifting the day", () => {
		expect(formatLongDate("2026-10-09")).toBe("sexta-feira, 9 de outubro");
		expect(formatFullDate("2026-01-01")).toBe("1 de janeiro de 2026");
		expect(formatShortDate("2026-12-31")).toBe("31/12");
	});

	it("names weekdays from Sunday = 0", () => {
		expect(weekdayName(0)).toBe("domingo");
		expect(weekdayName(6)).toBe("sábado");
		expect([0, 1, 2, 3, 4, 5, 6].map(weekdayInitial).join("")).toBe("DSTQQSS");
	});

	it("names months", () => {
		expect(monthShortName(1)).toBe("jan");
		expect(monthShortName(12)).toBe("dez");
	});

	it("formats ratios and counts", () => {
		expect(formatPercent(0.6)).toBe("60%");
		expect(formatPercent(1 / 3)).toBe("33%");
		expect(pluralHabits(1)).toBe("1 hábito");
		expect(pluralHabits(0)).toBe("0 hábitos");
	});

	it("summarizes weekday schedules", () => {
		expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
		expect(formatWeekdays([5, 1, 2, 3, 4])).toBe("Dias úteis");
		expect(formatWeekdays([6, 0])).toBe("Fins de semana");
		expect(formatWeekdays([5, 1, 3])).toBe("seg, qua, sex");
	});
});
