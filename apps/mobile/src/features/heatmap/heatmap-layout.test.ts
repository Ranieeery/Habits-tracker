import { nightColors } from "@habits/design-tokens";
import { buildYearGrid, type GridCell, type GridWeek } from "@habits/core";
import { describe, expect, it } from "vitest";
import {
	bubbleLeft,
	CELL_PITCH,
	canOpen,
	cellAt,
	cellLabel,
	dayIndexAt,
	dayValue,
	defaultDayIndex,
	hasGlow,
	initialWeekIndex,
	levelFill,
	MONTH_ROW_HEIGHT,
	previewLines,
	stepDay,
	SWEEP_CELL_MS,
	sweepDelay,
	sweepDuration,
	visibleWeekCount,
	weekLabel,
	weekSignature,
} from "./heatmap-layout.ts";

/** The week of Sunday 2026-10-04 with today = Friday 2026-10-09. */
function octoberWeek(): GridWeek {
	const grid = buildYearGrid({
		year: 2026,
		today: "2026-10-09",
		summary: [
			{ date: "2026-10-05", completed: 1, possible: 2 },
			{ date: "2026-10-09", completed: 3, possible: 5 },
		],
	});
	const week = grid.weeks[grid.today_week_index!]!;
	expect(week.start).toBe("2026-10-04");
	return week;
}

describe("visibleWeekCount", () => {
	it("counts whole 32 dp columns, at least one", () => {
		expect(CELL_PITCH).toBe(32);
		expect(visibleWeekCount(320)).toBe(10);
		expect(visibleWeekCount(352)).toBe(11);
		expect(visibleWeekCount(10)).toBe(1);
	});
});

describe("initialWeekIndex", () => {
	const base = { weekCount: 53, visibleWeeks: 8 };

	it("puts the current week near the right edge with one week after it", () => {
		const start = initialWeekIndex({ ...base, todayWeekIndex: 40 });
		expect(start).toBe(34);
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

describe("dayIndexAt", () => {
	it("maps a touch to the weekday row under it", () => {
		expect(dayIndexAt(MONTH_ROW_HEIGHT)).toBe(0);
		expect(dayIndexAt(MONTH_ROW_HEIGHT + CELL_PITCH - 1)).toBe(0);
		expect(dayIndexAt(MONTH_ROW_HEIGHT + CELL_PITCH)).toBe(1);
		expect(dayIndexAt(MONTH_ROW_HEIGHT + CELL_PITCH * 6.5)).toBe(6);
	});

	it("ignores the month row and anything below Saturday", () => {
		expect(dayIndexAt(0)).toBeNull();
		expect(dayIndexAt(MONTH_ROW_HEIGHT - 1)).toBeNull();
		expect(dayIndexAt(MONTH_ROW_HEIGHT + CELL_PITCH * 7)).toBeNull();
	});
});

describe("canOpen", () => {
	it("opens past days and today, never the future or padding days", () => {
		const cell = (shown: boolean, relation: GridCell["relation"]) => ({
			shown,
			preview: false,
			relation,
		});
		expect(canOpen(cell(true, "past"))).toBe(true);
		expect(canOpen(cell(true, "today"))).toBe(true);
		expect(canOpen(cell(true, "future"))).toBe(false);
		expect(canOpen(cell(false, "past"))).toBe(false);
		expect(canOpen(undefined)).toBe(false);
	});

	it("opens the preview days (2.14.0), also in the next year", () => {
		expect(canOpen({ shown: true, preview: true, relation: "future" })).toBe(
			true
		);
	});
});

describe("weekSignature", () => {
	it("changes only when something the column shows changes", () => {
		const week = octoberWeek();
		const copy: GridWeek = {
			...week,
			days: week.days.map((day) => ({ ...day })),
		};
		expect(weekSignature(copy)).toBe(weekSignature(week));

		const days = copy.days.map((day): GridCell =>
			day.date === "2026-10-09" ? { ...day, completed: 4 } : day
		);
		expect(weekSignature({ ...copy, days })).not.toBe(weekSignature(week));
	});
});

describe("labels", () => {
	it("reads a day with its date and ratio", () => {
		const cell = {
			date: "2026-10-09",
			relation: "past" as const,
			preview: false,
			completed: 3,
			possible: 5,
			ratio: 0.6,
		};
		expect(cellLabel(cell)).toBe(
			"9 de outubro de 2026: 3 de 5 hábitos concluídos (60%)"
		);
		expect(cellLabel({ ...cell, relation: "today" })).toBe(
			"9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"
		);
		expect(cellLabel({ ...cell, possible: 0, completed: 0, ratio: 0 })).toBe(
			"9 de outubro de 2026: nenhum hábito previsto"
		);
		expect(cellLabel({ ...cell, relation: "future" })).toBe(
			"9 de outubro de 2026: dia futuro"
		);
	});

	it("names a week by its first and last days in the year", () => {
		expect(weekLabel(octoberWeek())).toBe("Semana de 4 a 10 de outubro");
		const grid = buildYearGrid({ year: 2026, today: "2026-10-09" });
		const septOct = grid.weeks.find((week) => week.start === "2026-09-27")!;
		expect(weekLabel(septOct)).toBe("Semana de 27 de setembro a 3 de outubro");
		// 2026 starts on a Thursday: the first column holds only Jan 1-3.
		expect(weekLabel(grid.weeks[0]!)).toBe("Semana de 1 a 3 de janeiro");
	});

	it("reads the chosen day with its weekday", () => {
		expect(dayValue(octoberWeek(), 5)).toBe(
			"sexta-feira, 9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"
		);
	});
});

describe("screen reader day choice", () => {
	it("starts on today, else on the last day that opens", () => {
		const week = octoberWeek();
		expect(defaultDayIndex(week)).toBe(5);
		const grid = buildYearGrid({ year: 2026, today: "2026-10-09" });
		const past = grid.weeks[grid.today_week_index! - 1]!;
		expect(defaultDayIndex(past)).toBe(6);
	});

	it("steps between days that open, never into the future", () => {
		const week = octoberWeek();
		expect(stepDay(week, 5, -1)).toBe(4);
		expect(stepDay(week, 0, -1)).toBe(0);
		// Saturday 10/10 is in the future: today stays.
		expect(stepDay(week, 5, 1)).toBe(5);
	});

	it("skips the padding days of the first week", () => {
		const grid = buildYearGrid({ year: 2026, today: "2026-10-09" });
		const first = grid.weeks[0]!;
		// Sunday to Wednesday belong to 2025.
		expect(defaultDayIndex(first)).toBe(6);
		expect(stepDay(first, 4, -1)).toBe(4);
	});
});

describe("levels", () => {
	it("fills each level with its night token and lights levels 4-5", () => {
		expect(levelFill(0)).toBe(nightColors.heat[0]);
		expect(levelFill(5)).toBe(nightColors.heat[5]);
		expect([0, 1, 2, 3, 4, 5].map((l) => hasGlow(l as 0))).toEqual([
			false,
			false,
			false,
			false,
			true,
			true,
		]);
	});
});

describe("entrance sweep", () => {
	it("starts at the current week and spreads outwards", () => {
		expect(sweepDelay(40, 40)).toBe(0);
		expect(sweepDelay(39, 40)).toBe(6);
		expect(sweepDelay(41, 40)).toBe(6);
	});

	it("ends after the farthest column has faded in, within ~540 ms", () => {
		expect(sweepDuration(53, 40)).toBe(40 * 6 + SWEEP_CELL_MS);
		expect(sweepDuration(53, 52)).toBeLessThanOrEqual(540);
		expect(sweepDuration(1, 0)).toBe(SWEEP_CELL_MS);
	});
});

describe("day preview (2.10.0)", () => {
	const grid = buildYearGrid({
		year: 2026,
		today: "2026-10-09",
		summary: [
			{ date: "2026-10-05", completed: 1, possible: 2 },
			{ date: "2026-10-09", completed: 3, possible: 5 },
		],
	});
	const todayWeek = grid.today_week_index!;
	/** The middle of a slot, in list coordinates without scrolling. */
	const xOf = (weekIndex: number) => weekIndex * CELL_PITCH + CELL_PITCH / 2;
	const yOf = (dayIndex: number) =>
		MONTH_ROW_HEIGHT + dayIndex * CELL_PITCH + CELL_PITCH / 2;

	describe("cellAt", () => {
		it("finds the day under the finger, with the list scrolled", () => {
			const scrollX = (todayWeek - 3) * CELL_PITCH + 10;
			const x = xOf(todayWeek) - scrollX;
			expect(cellAt(x, yOf(1), scrollX, grid.weeks)).toEqual({
				weekIndex: todayWeek,
				dayIndex: 1,
			});
		});

		it("counts the gap between squares as part of the slot", () => {
			const edge = todayWeek * CELL_PITCH + CELL_PITCH - 1;
			expect(cellAt(edge, yOf(0), 0, grid.weeks)?.weekIndex).toBe(todayWeek);
			expect(cellAt(edge + 1, yOf(0), 0, grid.weeks)?.weekIndex).not.toBe(
				todayWeek
			);
		});

		it("ignores the month labels, the future and outside the weeks", () => {
			expect(
				cellAt(xOf(todayWeek), MONTH_ROW_HEIGHT - 1, 0, grid.weeks)
			).toBeNull();
			// Saturday 2026-10-10 is after today.
			expect(cellAt(xOf(todayWeek), yOf(6), 0, grid.weeks)).toBeNull();
			expect(cellAt(-1, yOf(1), 0, grid.weeks)).toBeNull();
			expect(cellAt(xOf(grid.weeks.length), yOf(1), 0, grid.weeks)).toBeNull();
			expect(cellAt(xOf(0), yOf(7), 0, grid.weeks)).toBeNull();
		});

		it("ignores the padding days before January 1", () => {
			// 2026-01-01 is a Thursday: Sunday to Wednesday of week 0 are 2025.
			expect(cellAt(xOf(0), yOf(0), 0, grid.weeks)).toBeNull();
			expect(cellAt(xOf(0), yOf(4), 0, grid.weeks)).toEqual({
				weekIndex: 0,
				dayIndex: 4,
			});
		});
	});

	describe("previewLines", () => {
		const day = (date: string) =>
			grid.weeks
				.flatMap((week) => week.days)
				.find((cell) => cell.date === date)!;

		it("shows the date and the share done", () => {
			expect(previewLines(day("2026-10-05"), { filtered: false })).toEqual({
				title: "seg, 5 de out",
				detail: "1 de 2 · 50%",
			});
			expect(previewLines(day("2026-10-09"), { filtered: false })).toEqual({
				title: "sex, 9 de out (hoje)",
				detail: "3 de 5 · 60%",
			});
		});

		it("says when nothing was due", () => {
			expect(previewLines(day("2026-10-06"), { filtered: false }).detail).toBe(
				"Nenhum hábito previsto"
			);
		});

		it("speaks of one habit when the history is filtered", () => {
			const one = (completed: number, possible: number) =>
				previewLines(
					{ ...day("2026-10-05"), completed, possible },
					{ filtered: true }
				).detail;
			expect(one(1, 1)).toBe("Feito");
			expect(one(0, 1)).toBe("Não feito");
			expect(one(0, 0)).toBe("Sem previsão");
		});
	});

	describe("bubbleLeft", () => {
		it("centers on the column and stays inside the container", () => {
			expect(bubbleLeft(150, 100, 300)).toBe(100);
			expect(bubbleLeft(20, 100, 300)).toBe(0);
			expect(bubbleLeft(290, 100, 300)).toBe(200);
			expect(bubbleLeft(50, 400, 300)).toBe(0);
		});
	});
});

describe("preview days (2.14.0)", () => {
	// Friday 2026-10-09: the preview is Saturday 10 to Friday 16, in today's
	// week and the next; the rest of the year stays plain future days.
	const grid = buildYearGrid({
		year: 2026,
		today: "2026-10-09",
		summary: [{ date: "2026-10-09", completed: 3, possible: 5 }],
		previewDays: 7,
	});
	const cellOn = (date: string) =>
		grid.weeks.flatMap((week) => week.days).find((day) => day.date === date)!;
	const nextIndex = grid.today_week_index! + 1;
	const nextWeek = grid.weeks[nextIndex]!;
	const yOf = (dayIndex: number) =>
		MONTH_ROW_HEIGHT + CELL_PITCH * dayIndex + CELL_PITCH / 2;
	const xOf = (weekIndex: number) => weekIndex * CELL_PITCH + CELL_PITCH / 2;

	it("keeps the whole year: the 8th day on is drawn but never opens", () => {
		expect(grid.weeks).toHaveLength(53);
		// Friday 16 (row 5) opens; Saturday 17 (row 6) is a plain future day.
		expect(cellAt(xOf(nextIndex), yOf(5), 0, grid.weeks)).toEqual({
			weekIndex: nextIndex,
			dayIndex: 5,
		});
		expect(cellAt(xOf(nextIndex), yOf(6), 0, grid.weeks)).toBeNull();
		expect(cellOn("2026-10-17")).toMatchObject({
			shown: true,
			preview: false,
			relation: "future",
		});
		expect(canOpen(cellOn("2026-12-31"))).toBe(false);
		expect(cellLabel(cellOn("2026-12-31"))).toBe(
			"31 de dezembro de 2026: dia futuro"
		);
	});

	it("reads a preview day without its content", () => {
		expect(cellLabel(cellOn("2026-10-12"))).toBe(
			"12 de outubro, dia futuro, toque para ver o que está programado"
		);
		expect(previewLines(cellOn("2026-10-12"), { filtered: false })).toEqual({
			title: "seg, 12 de out",
			detail: "Dia futuro",
		});
		expect(previewLines(cellOn("2026-10-12"), { filtered: true })).toEqual({
			title: "seg, 12 de out",
			detail: "Dia futuro",
		});
	});

	it("lets a screen reader step into the preview, up to today + 7", () => {
		const current = grid.weeks[grid.today_week_index!]!;
		// From today (Friday) down to Saturday 10, a preview day.
		expect(stepDay(current, 5, 1)).toBe(6);
		// The next week stops on Friday 16.
		expect(stepDay(nextWeek, 5, 1)).toBe(5);
		expect(weekLabel(nextWeek)).toBe("Semana de 11 a 17 de outubro");
		// A week after the preview has nothing to open.
		expect(stepDay(grid.weeks[nextIndex + 1]!, 0, 1)).toBe(0);
	});

	it("crosses New Year only when the 7 days do", () => {
		const december = buildYearGrid({
			year: 2026,
			today: "2026-12-28",
			previewDays: 7,
		});
		expect(december.weeks).toHaveLength(54);
		expect(weekLabel(december.weeks.at(-2)!)).toBe(
			"Semana de 27 de dezembro a 2 de janeiro"
		);
		expect(weekLabel(december.weeks.at(-1)!)).toBe(
			"Semana de 3 a 4 de janeiro"
		);
	});

	it("redraws a column when a day enters or leaves the preview", () => {
		const before = buildYearGrid({ year: 2026, today: "2026-10-09" });
		expect(weekSignature(nextWeek)).not.toBe(
			weekSignature(before.weeks[nextIndex]!)
		);
		// Columns after the preview are unchanged.
		expect(weekSignature(grid.weeks[nextIndex + 1]!)).toBe(
			weekSignature(before.weeks[nextIndex + 1]!)
		);
	});

	it("opens with today's week and the whole preview in view", () => {
		const visibleWeeks = 10;
		const start = initialWeekIndex({
			todayWeekIndex: grid.today_week_index,
			weekCount: grid.weeks.length,
			visibleWeeks,
		});
		expect(start).toBeLessThanOrEqual(grid.today_week_index!);
		expect(nextIndex).toBeLessThan(start + visibleWeeks);
	});
});
