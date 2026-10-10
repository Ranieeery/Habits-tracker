import { colors } from "@habits/design-tokens";
import { describe, expect, it } from "vitest";
import {
	CELL_PITCH,
	cellLabel,
	initialWeekIndex,
	levelColors,
	visibleWeekCount,
} from "./heatmap-layout.ts";

describe("visibleWeekCount", () => {
	it("counts whole 44 dp columns, at least one", () => {
		expect(CELL_PITCH).toBe(44);
		expect(visibleWeekCount(320)).toBe(7);
		expect(visibleWeekCount(352)).toBe(8);
		expect(visibleWeekCount(10)).toBe(1);
	});
});

describe("initialWeekIndex", () => {
	const base = { weekCount: 53, visibleWeeks: 8 };

	it("puts the current week near the right edge with one week after it", () => {
		const start = initialWeekIndex({ ...base, todayWeekIndex: 40 });
		expect(start).toBe(34);
		// Columns 34..41 are visible: the current week (40) and one more.
		expect(40 - start).toBe(6);
	});

	it("starts at the first week early in January", () => {
		expect(initialWeekIndex({ ...base, todayWeekIndex: 0 })).toBe(0);
		expect(initialWeekIndex({ ...base, todayWeekIndex: 3 })).toBe(0);
	});

	it("never scrolls past the last full screen in late December", () => {
		expect(initialWeekIndex({ ...base, todayWeekIndex: 52 })).toBe(45);
	});

	it("shows the end of the year when today is not in the grid", () => {
		expect(initialWeekIndex({ ...base, todayWeekIndex: null })).toBe(45);
	});

	it("handles screens wider than the year", () => {
		expect(
			initialWeekIndex({ weekCount: 53, visibleWeeks: 60, todayWeekIndex: 40 })
		).toBe(0);
	});
});

describe("levelColors", () => {
	it("maps each level to the token fill and border", () => {
		expect(levelColors(0)).toEqual({
			fill: colors.heatmap[0],
			border: colors.heatmap["0-border"],
		});
		expect(levelColors(5)).toEqual({
			fill: colors.heatmap[5],
			border: colors.heatmap["5-border"],
		});
	});
});

describe("cellLabel", () => {
	const cell = {
		date: "2026-10-09",
		relation: "past" as const,
		completed: 3,
		possible: 5,
		ratio: 0.6,
	};

	it("reads the date and the completion ratio", () => {
		expect(cellLabel(cell)).toBe(
			"9 de outubro de 2026: 3 de 5 hábitos concluídos (60%)"
		);
	});

	it("marks today", () => {
		expect(cellLabel({ ...cell, relation: "today" })).toBe(
			"9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"
		);
	});

	it("says when nothing was planned, and for future days", () => {
		expect(cellLabel({ ...cell, possible: 0, completed: 0, ratio: 0 })).toBe(
			"9 de outubro de 2026: nenhum hábito previsto"
		);
		expect(cellLabel({ ...cell, relation: "future" })).toBe(
			"9 de outubro de 2026: dia futuro"
		);
	});
});
