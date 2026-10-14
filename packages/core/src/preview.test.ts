// The heatmap preview of the next days (2.14.0): the window, the grid's
// extra cells, statistics blind to them, and what a preview day lists.
import type {
	Completion,
	Habit,
	Schedule,
	SummaryDay,
} from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { addDays, weekdayOf } from "./dates.ts";
import { buildYearGrid, type GridCell, monthLabels } from "./grid.ts";
import { weeklyTrend } from "./insights.ts";
import { overviewStats } from "./overview.ts";
import {
	isPreviewDate,
	PREVIEW_DAYS,
	previewDayView,
	previewEnd,
	previewItems,
} from "./preview.ts";
import { dayStreaks } from "./streaks.ts";
import { dayView, summarizeYear } from "./views.ts";
import { todayIn } from "./window.ts";
import { NO_RESCHEDULES } from "./reschedule-index.ts";

const TZ = { reschedules: NO_RESCHEDULES, timeZone: "America/Sao_Paulo" };

let counter = 0;
function habit(schedule: Schedule, overrides: Partial<Habit> = {}): Habit {
	counter += 1;
	return {
		id: `00000000-0000-7000-8000-${String(counter).padStart(12, "0")}`,
		name: `Hábito ${counter}`,
		description: "",
		schedule,
		start_date: "2026-01-01",
		archived_at: null,
		sort_key: `a${counter}`,
		created_at: Date.UTC(2026, 0, 1, 12),
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

function completion(
	habitId: string,
	date: string
): Pick<Completion, "habit_id" | "date" | "deleted_at"> {
	return { habit_id: habitId, date, deleted_at: null };
}

const cells = (grid: ReturnType<typeof buildYearGrid>): GridCell[] =>
	grid.weeks.flatMap((week) => week.days);

describe("isPreviewDate", () => {
	const today = "2026-10-13";

	it("covers today + 1 up to today + PREVIEW_DAYS", () => {
		expect(PREVIEW_DAYS).toBe(7);
		expect(isPreviewDate("2026-10-14", today)).toBe(true);
		expect(isPreviewDate("2026-10-20", today)).toBe(true);
		expect(previewEnd(today)).toBe("2026-10-20");
	});

	it("leaves out today + 8, today and the past", () => {
		expect(isPreviewDate("2026-10-21", today)).toBe(false);
		expect(isPreviewDate(today, today)).toBe(false);
		expect(isPreviewDate("2026-10-12", today)).toBe(false);
		expect(isPreviewDate("2025-10-14", today)).toBe(false);
	});

	it("crosses months and years", () => {
		expect(isPreviewDate("2027-01-03", "2026-12-28")).toBe(true);
		expect(isPreviewDate("2027-01-05", "2026-12-28")).toBe(false);
		expect(isPreviewDate("2028-03-01", "2028-02-28")).toBe(true);
	});
});

describe("buildYearGrid with a preview", () => {
	const summary: SummaryDay[] = [
		{ date: "2026-10-12", completed: 2, possible: 4 },
		{ date: "2026-10-13", completed: 1, possible: 2 },
	];

	it("keeps every past cell and today identical with and without it", () => {
		const today = "2026-10-13";
		const without = buildYearGrid({ year: 2026, today, summary });
		const with7 = buildYearGrid({ year: 2026, today, summary, previewDays: 7 });
		const upToToday = (grid: typeof without) =>
			cells(grid).filter((cell) => cell.date <= today);
		expect(upToToday(with7)).toEqual(upToToday(without));
		expect(with7.today_week_index).toBe(without.today_week_index);
	});

	it("without a preview, shown equals in_year and nothing is a preview", () => {
		const grid = buildYearGrid({ year: 2026, today: "2026-10-13", summary });
		for (const cell of cells(grid)) {
			expect(cell.shown).toBe(cell.in_year);
			expect(cell.preview).toBe(false);
		}
		expect(grid.weeks).toHaveLength(53);
	});

	it("marks the 7 next days as preview, empty, and keeps the whole year", () => {
		// Tuesday: the preview ends next Tuesday.
		const today = "2026-10-13";
		const without = buildYearGrid({ year: 2026, today, summary });
		const grid = buildYearGrid({ year: 2026, today, summary, previewDays: 7 });
		const preview = cells(grid).filter((cell) => cell.preview);
		expect(preview.map((cell) => cell.date)).toEqual([
			"2026-10-14",
			"2026-10-15",
			"2026-10-16",
			"2026-10-17",
			"2026-10-18",
			"2026-10-19",
			"2026-10-20",
		]);
		for (const cell of preview) {
			expect(cell).toMatchObject({
				relation: "future",
				shown: true,
				completed: 0,
				possible: 0,
				level: 0,
			});
		}
		// Same weeks as without it: the grid still runs to December 31.
		expect(grid.weeks).toHaveLength(53);
		expect(grid.weeks.map((week) => week.start)).toEqual(
			without.weeks.map((week) => week.start)
		);
		// The 8th day and the rest of the year stay plain future days.
		const later = cells(grid).filter(
			(cell) => cell.in_year && cell.date > "2026-10-20"
		);
		expect(later[0]!.date).toBe("2026-10-21");
		expect(later.at(-1)!.date).toBe("2026-12-31");
		for (const cell of later) {
			expect(cell).toMatchObject({
				relation: "future",
				shown: true,
				preview: false,
			});
		}
		// Only the padding after December 31 is not drawn.
		expect(
			cells(grid)
				.filter((cell) => !cell.shown)
				.map((cell) => cell.date)
		).toEqual(
			cells(without)
				.filter((cell) => !cell.in_year)
				.map((cell) => cell.date)
		);
	});

	it("today on a Saturday: the preview fills exactly the next week", () => {
		const today = "2026-10-17";
		expect(weekdayOf(today)).toBe(6);
		const grid = buildYearGrid({ year: 2026, today, previewDays: 7 });
		const next = grid.weeks[grid.today_week_index! + 1]!;
		expect(next.start).toBe("2026-10-18");
		expect(next.days.every((cell) => cell.preview)).toBe(true);
		expect(
			grid.weeks[grid.today_week_index!]!.days.some((cell) => cell.preview)
		).toBe(false);
	});

	it("today on a Sunday: six days this week, one in the next", () => {
		const today = "2026-10-18";
		expect(weekdayOf(today)).toBe(0);
		const grid = buildYearGrid({ year: 2026, today, previewDays: 7 });
		const current = grid.weeks[grid.today_week_index!]!;
		expect(current.days.filter((cell) => cell.preview)).toHaveLength(6);
		const next = grid.weeks[grid.today_week_index! + 1]!;
		expect(next.days.map((cell) => cell.preview)).toEqual([
			true,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
	});

	it("crosses a month boundary", () => {
		const grid = buildYearGrid({
			year: 2026,
			today: "2026-10-28",
			previewDays: 7,
		});
		const preview = cells(grid).filter((cell) => cell.preview);
		expect(preview[0]!.date).toBe("2026-10-29");
		expect(preview.at(-1)!.date).toBe("2026-11-04");
		expect(monthLabels(grid)).toEqual(
			monthLabels(buildYearGrid({ year: 2026, today: "2026-10-28" }))
		);
	});

	it("crosses New Year: only then the grid grows, with the January label", () => {
		const today = "2026-12-28";
		const grid = buildYearGrid({ year: 2026, today, previewDays: 7 });
		const preview = cells(grid).filter((cell) => cell.preview);
		expect(preview.map((cell) => cell.date)).toEqual([
			"2026-12-29",
			"2026-12-30",
			"2026-12-31",
			"2027-01-01",
			"2027-01-02",
			"2027-01-03",
			"2027-01-04",
		]);
		expect(preview.filter((cell) => !cell.in_year)).toHaveLength(4);
		// One more week than the plain year (53): up to the 7th day.
		expect(grid.weeks).toHaveLength(54);
		const lastWeek = grid.weeks.at(-1)!;
		expect(lastWeek.start).toBe("2027-01-03");
		// The last column is partial: January 3 and 4, then nothing.
		expect(lastWeek.days.map((cell) => cell.shown)).toEqual([
			true,
			true,
			false,
			false,
			false,
			false,
			false,
		]);
		expect(lastWeek.days[2]).toMatchObject({
			date: "2027-01-05",
			preview: false,
			shown: false,
		});
		const labels = monthLabels(grid);
		expect(labels.at(-1)).toEqual({ month: 1, week_index: 52 });
		expect(labels.filter((label) => label.month === 1)).toHaveLength(2);
	});

	it("does not grow when the preview ends on December 31", () => {
		const grid = buildYearGrid({
			year: 2026,
			today: "2026-12-24",
			previewDays: 7,
		});
		expect(
			cells(grid)
				.filter((cell) => cell.preview)
				.at(-1)!.date
		).toBe("2026-12-31");
		expect(grid.weeks).toHaveLength(53);
		expect(cells(grid).some((cell) => !cell.in_year && cell.shown)).toBe(false);
	});

	it("includes Feb 29 in a leap year", () => {
		const grid = buildYearGrid({
			year: 2028,
			today: "2028-02-25",
			previewDays: 7,
		});
		const preview = cells(grid).filter((cell) => cell.preview);
		expect(preview.map((cell) => cell.date)).toContain("2028-02-29");
		expect(preview.at(-1)!.date).toBe("2028-03-03");
	});

	it("follows the user's time zone through today", () => {
		// 2026-10-13 23:30 in São Paulo is already the 14th in Tokyo.
		const now = Date.UTC(2026, 9, 14, 2, 30);
		const saoPaulo = todayIn("America/Sao_Paulo", now);
		const tokyo = todayIn("Asia/Tokyo", now);
		expect([saoPaulo, tokyo]).toEqual(["2026-10-13", "2026-10-14"]);
		const lastPreview = (today: string) =>
			cells(buildYearGrid({ year: 2026, today, previewDays: 7 }))
				.filter((cell) => cell.preview)
				.at(-1)!.date;
		expect(lastPreview(saoPaulo)).toBe("2026-10-20");
		expect(lastPreview(tokyo)).toBe("2026-10-21");
	});

	it("does nothing for a year that does not hold today", () => {
		const today = "2027-01-03";
		const past = buildYearGrid({ year: 2026, today, previewDays: 7 });
		expect(past).toEqual(buildYearGrid({ year: 2026, today }));
		expect(cells(past).some((cell) => cell.preview)).toBe(false);
	});
});

describe("statistics never see the preview", () => {
	const today = "2026-10-13";
	const daily = habit({ type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] });
	const weekly = habit({ type: "weekdays", days: [2, 4] });
	const once = habit(
		{ type: "once", date: "2026-10-16" },
		{ start_date: "2026-10-16" }
	);
	const habits = [daily, weekly, once];
	const completions = [
		completion(daily.id, "2026-10-10"),
		completion(daily.id, "2026-10-11"),
		completion(daily.id, "2026-10-12"),
		completion(weekly.id, "2026-10-13"),
		completion(daily.id, "2026-10-13"),
	];
	const summary = summarizeYear(habits, completions, {
		year: 2026,
		today,
		...TZ,
	});

	it("the summary stops at today even with occurrences ahead", () => {
		expect(summary.at(-1)!.date).toBe(today);
	});

	it("grid counts, run, week, month and trend are identical with 0 and 7", () => {
		const fromGrid = (previewDays: number): SummaryDay[] =>
			cells(buildYearGrid({ year: 2026, today, summary, previewDays }))
				.filter((cell) => cell.possible > 0)
				.map(({ date, completed, possible }) => ({
					date,
					completed,
					possible,
				}));
		const without = fromGrid(0);
		const with7 = fromGrid(PREVIEW_DAYS);
		expect(with7).toEqual(without);
		expect(overviewStats({ days: with7, today, year: 2026 })).toEqual(
			overviewStats({ days: without, today, year: 2026 })
		);
		expect(dayStreaks(with7, today)).toEqual(dayStreaks(without, today));
		expect(weeklyTrend(with7, today)).toEqual(weeklyTrend(without, today));
	});
});

describe("what a preview day lists", () => {
	const today = "2026-10-13";
	const date = "2026-10-20"; // a Tuesday, today + 7
	const listed = (habits: Habit[], firsts: Record<string, string> = {}) =>
		previewItems(previewDayView(habits, firsts, date, TZ));
	const ids = (items: ReturnType<typeof listed>) =>
		items.map((item) => item.habit.id);

	it("lists each schedule type on the day it occurs", () => {
		const weekdays = habit({ type: "weekdays", days: [2] });
		const otherWeekday = habit({ type: "weekdays", days: [3] });
		const interval = habit({
			type: "interval",
			every: 7,
			anchor_date: "2026-10-13",
		});
		const intervalOff = habit({
			type: "interval",
			every: 5,
			anchor_date: "2026-10-13",
		});
		const monthly = habit({ type: "monthly_days", days: [20] });
		const once = habit({ type: "once", date }, { start_date: date });
		const yearly = habit({ type: "yearly", month: 10, day: 20 });
		const yearlyOff = habit({ type: "yearly", month: 10, day: 21 });
		const items = listed([
			weekdays,
			otherWeekday,
			interval,
			intervalOff,
			monthly,
			once,
			yearly,
			yearlyOff,
		]);
		expect(ids(items)).toEqual([
			weekdays.id,
			interval.id,
			monthly.id,
			once.id,
			yearly.id,
		]);
		expect(items.every((item) => !item.dueOnDay)).toBe(true);
	});

	it("lists a deadline task only on its due date, as due that day", () => {
		const dueThatDay = habit(
			{ type: "deadline", due_date: date },
			{ start_date: today }
		);
		const dueLater = habit(
			{ type: "deadline", due_date: "2026-10-25" },
			{ start_date: today }
		);
		expect(listed([dueThatDay, dueLater])).toEqual([
			{ habit: dueThatDay, dueOnDay: true },
		]);
		// On the days before its due date it is not listed.
		const before = previewItems(
			previewDayView([dueThatDay], {}, "2026-10-18", TZ)
		);
		expect(before).toEqual([]);
	});

	it("leaves out a deadline task already done", () => {
		const task = habit(
			{ type: "deadline", due_date: date },
			{ start_date: today }
		);
		expect(listed([task], { [task.id]: today })).toEqual([]);
	});

	it("never lists overdue habits (only today does)", () => {
		// Missed on the 10th: overdue today, not part of a future day.
		const missed = habit({ type: "monthly_days", days: [10] });
		expect(listed([missed])).toEqual([]);
	});

	it("leaves out archived, deleted and not yet started habits", () => {
		const archived = habit(
			{ type: "weekdays", days: [2] },
			{ archived_at: Date.UTC(2026, 9, 12, 15) }
		);
		const deleted = habit(
			{ type: "weekdays", days: [2] },
			{ archived_at: Date.UTC(2026, 9, 1), deleted_at: Date.UTC(2026, 9, 2) }
		);
		const later = habit(
			{ type: "weekdays", days: [2] },
			{ start_date: "2026-10-21" }
		);
		expect(listed([archived, deleted, later])).toEqual([]);
	});

	it("is exactly dayView's list (the day detail's own function)", () => {
		const habits = [
			habit({ type: "weekdays", days: [2] }),
			habit({ type: "deadline", due_date: date }, { start_date: today }),
		];
		expect(previewDayView(habits, {}, date, TZ)).toEqual(
			dayView(habits, [], date, TZ)
		);
		expect(addDays(today, PREVIEW_DAYS)).toBe(date);
	});
});
