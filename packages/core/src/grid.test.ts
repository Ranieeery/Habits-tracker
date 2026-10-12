import { describe, expect, it } from "vitest";
import {
	buildYearGrid,
	clampYear,
	heatmapYearRange,
	monthLabels,
} from "./grid.ts";

describe("buildYearGrid", () => {
	it("pads the first week of 2026 (Jan 1 is a Thursday)", () => {
		const grid = buildYearGrid({ year: 2026, today: "2026-10-09" });
		const firstWeek = grid.weeks[0]!;
		expect(firstWeek.start).toBe("2025-12-28");
		expect(firstWeek.days.map((cell) => cell.in_year)).toEqual([
			false,
			false,
			false,
			false,
			true,
			true,
			true,
		]);
		expect(grid.weeks).toHaveLength(53);
		expect(grid.weeks.at(-1)!.days.at(-1)!.date).toBe("2027-01-02");
	});

	it("always uses Sunday-first weeks of 7 days", () => {
		const grid = buildYearGrid({ year: 2026, today: "2026-10-09" });
		for (const week of grid.weeks) {
			expect(week.days).toHaveLength(7);
			expect(week.days[0]!.date).toBe(week.start);
		}
	});

	it("has no padding before a year starting on Sunday (2023)", () => {
		const grid = buildYearGrid({ year: 2023, today: "2023-06-01" });
		expect(grid.weeks[0]!.start).toBe("2023-01-01");
		expect(grid.weeks[0]!.days.every((cell) => cell.in_year)).toBe(true);
		// Dec 31, 2023 is a Sunday alone in the last week.
		expect(grid.weeks.at(-1)!.days.filter((c) => c.in_year)).toHaveLength(1);
	});

	it("includes Feb 29 and every day of a leap year", () => {
		const grid = buildYearGrid({ year: 2024, today: "2024-12-31" });
		const inYear = grid.weeks.flatMap((week) =>
			week.days.filter((cell) => cell.in_year)
		);
		expect(inYear).toHaveLength(366);
		expect(inYear.some((cell) => cell.date === "2024-02-29")).toBe(true);
	});

	it("spans 54 weeks when a leap year starts on Saturday (2028)", () => {
		expect(
			buildYearGrid({ year: 2028, today: "2028-01-01" }).weeks
		).toHaveLength(54);
	});

	it("marks past, today and future and locates the current week", () => {
		const grid = buildYearGrid({ year: 2026, today: "2026-01-02" });
		const cells = grid.weeks[0]!.days;
		expect(cells.map((cell) => cell.relation)).toEqual([
			"past",
			"past",
			"past",
			"past",
			"past",
			"today",
			"future",
		]);
		expect(grid.today_week_index).toBe(0);
		expect(
			buildYearGrid({ year: 2025, today: "2026-01-02" }).today_week_index
		).toBe(52); // the last 2025 week also holds Jan 1-3, 2026
		expect(
			buildYearGrid({ year: 2024, today: "2026-01-02" }).today_week_index
		).toBeNull();
	});

	it("fills levels from the summary", () => {
		const grid = buildYearGrid({
			year: 2026,
			today: "2026-01-10",
			summary: [
				{ date: "2026-01-05", completed: 1, possible: 4 },
				{ date: "2026-01-06", completed: 4, possible: 4 },
				{ date: "2026-01-07", completed: 0, possible: 4 },
			],
		});
		const byDate = new Map(
			grid.weeks.flatMap((week) => week.days).map((cell) => [cell.date, cell])
		);
		expect(byDate.get("2026-01-05")).toMatchObject({ ratio: 0.25, level: 2 });
		expect(byDate.get("2026-01-06")).toMatchObject({ ratio: 1, level: 5 });
		expect(byDate.get("2026-01-07")).toMatchObject({ possible: 4, level: 0 });
		expect(byDate.get("2026-01-08")).toMatchObject({ possible: 0, level: 0 });
	});
});

describe("monthLabels", () => {
	it("places each month at the week holding its 1st day (2026)", () => {
		const labels = monthLabels(
			buildYearGrid({ year: 2026, today: "2026-10-09" })
		);
		expect(labels.map((label) => label.month)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
		]);
		// Jan 1 (Thu) is in the first week; Feb 1 (Sun) starts week 5.
		expect(labels[0]).toEqual({ month: 1, week_index: 0 });
		expect(labels[1]).toEqual({ month: 2, week_index: 5 });
		// Dec 1, 2026 is a Tuesday in the week starting Nov 29 (index 48).
		expect(labels[11]).toEqual({ month: 12, week_index: 48 });
	});

	it("ignores the padding days of the next year", () => {
		// Jan 1, 2027 is in the last 2026 column but is not labeled.
		const labels = monthLabels(
			buildYearGrid({ year: 2026, today: "2026-10-09" })
		);
		expect(labels).toHaveLength(12);
	});
});

describe("heatmapYearRange", () => {
	const habit = (start_date: string, deleted_at: number | null = null) => ({
		start_date,
		deleted_at,
	});

	it("is only the current year without habits or with this year's only", () => {
		expect(heatmapYearRange([], "2026-10-11")).toEqual({
			first: 2026,
			last: 2026,
		});
		expect(heatmapYearRange([habit("2026-03-01")], "2026-10-11")).toEqual({
			first: 2026,
			last: 2026,
		});
	});

	it("starts at the oldest live habit and ignores deleted ones", () => {
		expect(
			heatmapYearRange(
				[habit("2025-06-01"), habit("2024-12-31"), habit("2019-01-01", 5)],
				"2026-10-11"
			)
		).toEqual({ first: 2024, last: 2026 });
	});

	it("follows today across the year boundary", () => {
		const habits = [habit("2026-12-01")];
		expect(heatmapYearRange(habits, "2026-12-31").last).toBe(2026);
		expect(heatmapYearRange(habits, "2027-01-01")).toEqual({
			first: 2026,
			last: 2027,
		});
	});

	it("never goes past the current year, even for a habit starting later", () => {
		expect(heatmapYearRange([habit("2027-02-01")], "2026-10-11")).toEqual({
			first: 2026,
			last: 2026,
		});
	});
});

describe("clampYear", () => {
	it("keeps the year inside the range", () => {
		const range = { first: 2024, last: 2026 };
		expect(clampYear(2025, range)).toBe(2025);
		expect(clampYear(2020, range)).toBe(2024);
		expect(clampYear(2030, range)).toBe(2026);
	});
});
