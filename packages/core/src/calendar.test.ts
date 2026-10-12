import { describe, expect, it } from "vitest";
import { addMonths, isMonthBefore, monthGrid, monthTitle } from "./calendar.ts";
import { formatDayMonthYear } from "./schedule-text.ts";

describe("monthGrid", () => {
	it("starts on Sunday and pads the first and last weeks", () => {
		// October 2026 starts on a Thursday and has 31 days.
		const weeks = monthGrid({ year: 2026, month: 10 });
		expect(weeks).toHaveLength(5);
		expect(weeks[0]).toEqual([
			null,
			null,
			null,
			null,
			"2026-10-01",
			"2026-10-02",
			"2026-10-03",
		]);
		expect(weeks[4]?.at(-1)).toBe("2026-10-31");
	});

	it("knows February 29", () => {
		const days = monthGrid({ year: 2028, month: 2 }).flat().filter(Boolean);
		expect(days.at(-1)).toBe("2028-02-29");
	});
});

describe("month navigation", () => {
	it("crosses year boundaries", () => {
		expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
			year: 2027,
			month: 1,
		});
		expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
			year: 2025,
			month: 12,
		});
		expect(monthTitle({ year: 2026, month: 11 })).toBe("novembro de 2026");
	});

	it("stops before the month of the earliest date", () => {
		expect(isMonthBefore({ year: 2026, month: 9 }, "2026-10-11")).toBe(true);
		expect(isMonthBefore({ year: 2026, month: 10 }, "2026-10-11")).toBe(false);
	});
});

describe("formatDayMonthYear", () => {
	it("puts the day first (pt-BR), never the US order", () => {
		expect(formatDayMonthYear("2026-10-22")).toBe("22/10/2026");
		expect(formatDayMonthYear("2027-01-05")).toBe("05/01/2027");
	});
});
