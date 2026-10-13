import { describe, expect, it } from "vitest";
import {
	STRIP_DAYS,
	stripDays,
	stripNeedsPreviousYear,
	stripStart,
} from "./week-strip-model.ts";

describe("week strip", () => {
	it("shows today and the six days before it, oldest first", () => {
		const days = stripDays("2026-10-12", []);
		expect(days).toHaveLength(STRIP_DAYS);
		expect(days.map((day) => day.date)).toEqual([
			"2026-10-06",
			"2026-10-07",
			"2026-10-08",
			"2026-10-09",
			"2026-10-10",
			"2026-10-11",
			"2026-10-12",
		]);
		expect(days.map((day) => day.initial).join("")).toBe("TQQSSDS");
		expect(days.at(-1)?.isToday).toBe(true);
		expect(days.filter((day) => day.isToday)).toHaveLength(1);
	});

	it("takes each day's level and words its progress", () => {
		const days = stripDays("2026-10-12", [
			{ date: "2026-10-11", completed: 2, possible: 2 },
			{ date: "2026-10-12", completed: 2, possible: 3 },
		]);
		expect(days[5]).toMatchObject({
			level: 5,
			dayOfMonth: "11",
			label: "domingo, 11 de outubro: 2 de 2 hábitos (100%)",
		});
		expect(days[6]).toMatchObject({
			level: 4,
			label: "segunda-feira, 12 de outubro (hoje): 2 de 3 hábitos (67%)",
		});
		expect(days[0]).toMatchObject({
			level: 0,
			label: "terça-feira, 6 de outubro: nenhum hábito previsto",
		});
	});

	it("reaches into last year only in early January", () => {
		expect(stripStart("2026-01-03")).toBe("2025-12-28");
		expect(stripNeedsPreviousYear("2026-01-03")).toBe(true);
		expect(stripNeedsPreviousYear("2026-01-07")).toBe(false);
		expect(stripNeedsPreviousYear("2026-10-12")).toBe(false);
		const days = stripDays("2026-01-03", [
			{ date: "2025-12-31", completed: 1, possible: 1 },
		]);
		expect(days[3]).toMatchObject({ date: "2025-12-31", level: 5 });
	});
});
