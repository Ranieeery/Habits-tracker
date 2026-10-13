import type { Completion, DayResponse, Habit } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { addDays } from "./dates.ts";
import {
	dayItems,
	isFixedDaySchedule,
	OVERDUE_DAYS,
	overdueLabel,
	overdueOccurrence,
	overdueOn,
	overdueRange,
	pendingTodayCount,
	todayView,
} from "./overdue.ts";
import { heatmapLevel, completionRatio } from "./progress.ts";
import { habitStreaks } from "./streaks.ts";
import { summarizeYear } from "./views.ts";

const SP = "America/Sao_Paulo"; // UTC-3, no DST
const TOKYO = "Asia/Tokyo"; // UTC+9
const sp = { timeZone: SP };

/** An instant given as São Paulo wall-clock time. */
const spAt = (date: string, time = "12:00") =>
	Date.parse(`${date}T${time}:00-03:00`);

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
	return {
		id,
		name: id,
		schedule: { type: "monthly_days", days: [15] },
		start_date: "2026-01-01",
		archived_at: null,
		description: "",
		sort_key: "a0",
		created_at: spAt("2026-01-01", "08:00"),
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

type Facts = Pick<Completion, "habit_id" | "date" | "deleted_at">;
const done = (habitId: string, date: string, deleted = false): Facts => ({
	habit_id: habitId,
	date,
	deleted_at: deleted ? 1 : null,
});

/** The occurrence for one habit with these completion dates. */
function occurrence(
	h: Habit,
	today: string,
	dates: string[] = [],
	options = sp
) {
	return overdueOccurrence(h, new Set(dates), today, options);
}

const monthly15 = habit("conta");

describe("isFixedDaySchedule", () => {
	it("is true for days of the month, single dates and yearly only", () => {
		expect(isFixedDaySchedule({ type: "monthly_days", days: [1] })).toBe(true);
		expect(isFixedDaySchedule({ type: "once", date: "2026-10-15" })).toBe(true);
		expect(isFixedDaySchedule({ type: "yearly", month: 2, day: 29 })).toBe(
			true
		);
		expect(isFixedDaySchedule({ type: "weekdays", days: [1] })).toBe(false);
		expect(
			isFixedDaySchedule({
				type: "interval",
				every: 3,
				anchor_date: "2026-10-01",
			})
		).toBe(false);
		expect(isFixedDaySchedule({ type: "lunar" })).toBe(false);
	});
});

describe("overdueRange", () => {
	it("covers OVERDUE_DAYS back and the server's tomorrow", () => {
		expect(OVERDUE_DAYS).toBe(15);
		expect(overdueRange("2026-10-16")).toEqual({
			from: "2026-10-01",
			to: "2026-10-17",
		});
	});
});

describe("overdueOccurrence", () => {
	it("is not overdue on the day itself (the normal item)", () => {
		expect(occurrence(monthly15, "2026-10-15")).toBeNull();
	});

	it("shows from O+1 up to O+15 and leaves at O+16", () => {
		expect(occurrence(monthly15, "2026-10-16")).toEqual({
			since: "2026-10-15",
			completedToday: false,
		});
		expect(occurrence(monthly15, "2026-10-30")).toEqual({
			since: "2026-10-15",
			completedToday: false,
		});
		expect(occurrence(monthly15, "2026-10-31")).toBeNull();
	});

	it("is fulfilled by a completion on O, O+1 or O+15", () => {
		expect(occurrence(monthly15, "2026-10-20", ["2026-10-15"])).toBeNull();
		expect(occurrence(monthly15, "2026-10-20", ["2026-10-16"])).toBeNull();
		expect(occurrence(monthly15, "2026-10-30", ["2026-10-30"])).toEqual({
			since: "2026-10-15",
			completedToday: true,
		});
	});

	it("ignores a completion after the limit and before O", () => {
		// O+16 is outside the window, so it never counted for O.
		expect(occurrence(monthly15, "2026-10-31", ["2026-10-31"])).toBeNull();
		expect(occurrence(monthly15, "2026-10-16", ["2026-10-14"])).toEqual({
			since: "2026-10-15",
			completedToday: false,
		});
	});

	it("keeps a habit completed today listed, and brings it back when unchecked", () => {
		const today = "2026-10-18";
		expect(occurrence(monthly15, today, [today])).toEqual({
			since: "2026-10-15",
			completedToday: true,
		});
		// Unchecking writes a tombstone: the live dates no longer have today.
		const dates = overdueOn(
			[monthly15],
			[done(monthly15.id, today, true)],
			today,
			sp
		);
		expect(dates).toEqual([
			{ habit: monthly15, since: "2026-10-15", completedToday: false },
		]);
	});

	it("is fulfilled by a completion made by editing a past day", () => {
		// Marked on O+3 (past-day editing) while today is O+5.
		expect(occurrence(monthly15, "2026-10-20", ["2026-10-18"])).toBeNull();
	});

	it("merges with the next occurrence", () => {
		const twice = habit("twice", {
			schedule: { type: "monthly_days", days: [10, 20] },
		});
		expect(occurrence(twice, "2026-10-19")).toEqual({
			since: "2026-10-10",
			completedToday: false,
		});
		// On the 20th only the normal item shows; afterwards, the 20th is the
		// overdue one, not the 10th.
		expect(occurrence(twice, "2026-10-20")).toBeNull();
		expect(occurrence(twice, "2026-10-21")).toEqual({
			since: "2026-10-20",
			completedToday: false,
		});
		// A completion on the 20th belongs to the 20th, not to the 10th.
		expect(occurrence(twice, "2026-10-21", ["2026-10-20"])).toBeNull();
	});

	it("ends the window the day before the next occurrence", () => {
		const twice = habit("twice", {
			schedule: { type: "monthly_days", days: [10, 12] },
		});
		// Window of the 10th: [10, 11]. A completion on the server's tomorrow
		// (the 12th) is the 12th's.
		expect(occurrence(twice, "2026-10-11", ["2026-10-12"])).toEqual({
			since: "2026-10-10",
			completedToday: false,
		});
	});

	it("handles day 31 in short months", () => {
		const day31 = habit("d31", {
			schedule: { type: "monthly_days", days: [31] },
		});
		// April has 30 days: the occurrence is April 30.
		expect(occurrence(day31, "2026-05-01")).toEqual({
			since: "2026-04-30",
			completedToday: false,
		});
		// February 2026 (not leap): February 28.
		expect(occurrence(day31, "2026-03-05")).toEqual({
			since: "2026-02-28",
			completedToday: false,
		});
		// February 2028 (leap): February 29.
		expect(
			occurrence(
				habit("d31", {
					schedule: { type: "monthly_days", days: [31] },
					start_date: "2028-01-01",
					created_at: spAt("2028-01-01"),
				}),
				"2028-03-01"
			)
		).toEqual({ since: "2028-02-29", completedToday: false });
	});

	it("handles a yearly February 29 in a year that is not leap", () => {
		const leap = habit("leap", {
			schedule: { type: "yearly", month: 2, day: 29 },
		});
		expect(occurrence(leap, "2027-03-01", [], sp)).toEqual({
			since: "2027-02-28",
			completedToday: false,
		});
		expect(occurrence(leap, "2027-03-15")).toEqual({
			since: "2027-02-28",
			completedToday: false,
		});
		expect(occurrence(leap, "2027-03-16")).toBeNull();
	});

	it("keeps a single date overdue until the limit (no next occurrence)", () => {
		const once = habit("consulta", {
			schedule: { type: "once", date: "2026-10-15" },
			start_date: "2026-10-15",
		});
		expect(occurrence(once, "2026-10-16")?.since).toBe("2026-10-15");
		expect(occurrence(once, "2026-10-30")?.since).toBe("2026-10-15");
		expect(occurrence(once, "2026-10-31")).toBeNull();
		// A completion on the server's tomorrow, inside the window, fulfills it.
		expect(occurrence(once, "2026-10-16", ["2026-10-17"])).toBeNull();
	});

	it("crosses month and year boundaries", () => {
		const christmas = habit("natal", {
			schedule: { type: "yearly", month: 12, day: 25 },
		});
		expect(occurrence(christmas, "2027-01-05")).toEqual({
			since: "2026-12-25",
			completedToday: false,
		});
		expect(occurrence(christmas, "2027-01-09")?.since).toBe("2026-12-25");
		expect(occurrence(christmas, "2027-01-10")).toBeNull();
		const day20 = habit("d20", {
			schedule: { type: "monthly_days", days: [20] },
		});
		expect(occurrence(day20, "2026-11-03")?.since).toBe("2026-10-20");
	});

	it("leaves out weekday and interval habits", () => {
		expect(
			occurrence(
				habit("w", { schedule: { type: "weekdays", days: [4] } }),
				"2026-10-16"
			)
		).toBeNull();
		expect(
			occurrence(
				habit("i", {
					schedule: { type: "interval", every: 10, anchor_date: "2026-10-05" },
				}),
				"2026-10-16"
			)
		).toBeNull();
	});

	it("leaves out archived and deleted habits", () => {
		expect(
			occurrence(
				habit("a", { archived_at: spAt("2026-10-16", "07:00") }),
				"2026-10-16"
			)
		).toBeNull();
		expect(
			occurrence(habit("d", { deleted_at: spAt("2026-10-16") }), "2026-10-16")
		).toBeNull();
	});

	it("leaves out occurrences before the start or the creation", () => {
		expect(
			occurrence(habit("s", { start_date: "2026-10-16" }), "2026-10-17")
		).toBeNull();
		// Created on the 16th with a start in the past (offline backfill).
		expect(
			occurrence(
				habit("c", {
					start_date: "2026-10-01",
					created_at: spAt("2026-10-16", "09:00"),
				}),
				"2026-10-17"
			)
		).toBeNull();
		// Created on O itself: O counts.
		expect(
			occurrence(
				habit("c", { created_at: spAt("2026-10-15", "21:00") }),
				"2026-10-17"
			)?.since
		).toBe("2026-10-15");
	});

	it("reads the creation day in the user's time zone", () => {
		// 2026-10-15 22:00 in São Paulo is already 10:00 of the 16th in Tokyo.
		const late = habit("late", { created_at: spAt("2026-10-15", "22:00") });
		expect(occurrence(late, "2026-10-17", [], sp)?.since).toBe("2026-10-15");
		expect(occurrence(late, "2026-10-17", [], { timeZone: TOKYO })).toBeNull();
	});
});

describe("overdueOn", () => {
	it("lists overdue habits in the user's order, ignoring tombstones", () => {
		const b = habit("b", { sort_key: "a2" });
		const a = habit("a", { sort_key: "a1" });
		const fulfilled = habit("f", { sort_key: "a0" });
		const items = overdueOn(
			[b, a, fulfilled],
			[done("f", "2026-10-15"), done("a", "2026-10-15", true)],
			"2026-10-16",
			sp
		);
		expect(items.map((item) => item.habit.id)).toEqual(["a", "b"]);
	});
});

describe("pendingTodayCount", () => {
	it("adds the overdue habits not completed today", () => {
		const daily = habit("daily", {
			schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		});
		const other = habit("other", {
			schedule: { type: "monthly_days", days: [14] },
		});
		const today = "2026-10-16";
		expect(pendingTodayCount([daily, monthly15, other], [], today, sp)).toBe(3);
		expect(
			pendingTodayCount(
				[daily, monthly15, other],
				[done("conta", today), done("daily", today)],
				today,
				sp
			)
		).toBe(1);
	});
});

describe("dayItems", () => {
	const a = habit("a", { schedule: { type: "weekdays", days: [5] } });
	const b = habit("b", { schedule: { type: "weekdays", days: [5] } });
	const day = (completed: string[], possible = [a, b]): DayResponse => ({
		date: "2026-10-16",
		possible_habits: possible,
		completed_habit_ids: completed,
		overdue: [
			{ habit: monthly15, since: "2026-10-15", completed_today: false },
		],
	});

	it("puts overdue habits first and leaves them out of the progress while pending", () => {
		const { items, progress } = dayItems(day(["a"]));
		expect(items).toEqual([
			{ habit: monthly15, done: false, overdueSince: "2026-10-15" },
			{ habit: a, done: true, overdueSince: null },
			{ habit: b, done: false, overdueSince: null },
		]);
		expect(progress).toEqual({ possible: 2, completed: 1 });
	});

	it("counts an overdue habit once it is completed, without listing it twice", () => {
		// The server lists a habit completed today among the possible ones.
		const { items, progress } = dayItems(
			day(["a", "conta"], [a, b, monthly15])
		);
		expect(items.map((item) => item.habit.id)).toEqual(["conta", "a", "b"]);
		expect(items[0]).toMatchObject({ done: true, overdueSince: "2026-10-15" });
		expect(progress).toEqual({ possible: 3, completed: 2 });
		// The optimistic cache only changed the completed ids: same result.
		expect(dayItems(day(["a", "conta"])).progress).toEqual(progress);
	});

	it("is the plain day without the overdue field", () => {
		const { overdue: _, ...plain } = day(["b"]);
		expect(dayItems(plain)).toEqual({
			items: [
				{ habit: a, done: false, overdueSince: null },
				{ habit: b, done: true, overdueSince: null },
			],
			progress: { possible: 2, completed: 1 },
		});
	});
});

describe("overdueLabel", () => {
	it("gives the badge and the spoken text", () => {
		expect(overdueLabel("2026-10-11", "2026-10-16")).toEqual({
			text: "Atrasado desde 11/10",
			spoken: "atrasado desde 11 de outubro",
		});
		expect(overdueLabel("2026-12-25", "2027-01-05")).toEqual({
			text: "Atrasado desde 25/12/2026",
			spoken: "atrasado desde 25 de dezembro de 2026",
		});
	});
});

describe("counting with overdue habits (no double counting)", () => {
	// Today = 16/10. A and B every day, C on day 15.
	const A = habit("A", {
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
	});
	const B = habit("B", {
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
	});
	const C = habit("C");
	const habits = [A, B, C];
	const base = [
		done("A", "2026-10-15"),
		done("B", "2026-10-15"),
		done("A", "2026-10-16"),
		done("B", "2026-10-16"),
	];
	const summary = (completions: Facts[], today: string) =>
		new Map(
			summarizeYear(habits, completions, {
				year: 2026,
				today,
				timeZone: SP,
			}).map((day) => [day.date, day])
		);

	it("keeps the failure on the missed day and leaves the pending item out", () => {
		const days = summary(base, "2026-10-16");
		expect(days.get("2026-10-15")).toMatchObject({ possible: 3, completed: 2 });
		expect(days.get("2026-10-16")).toMatchObject({ possible: 2, completed: 2 });
		const view = todayView(habits, base, "2026-10-16", sp);
		expect(view.overdue).toEqual([
			{ habit: C, since: "2026-10-15", completed_today: false },
		]);
		expect(dayItems(view).progress).toEqual({ possible: 2, completed: 2 });
	});

	it("counts a late completion as done and possible on the day it was made", () => {
		const late = [...base, done("C", "2026-10-16")];
		const days = summary(late, "2026-10-16");
		expect(days.get("2026-10-15")).toMatchObject({ possible: 3, completed: 2 });
		expect(days.get("2026-10-16")).toMatchObject({ possible: 3, completed: 3 });
		expect(heatmapLevel(completionRatio(2, 3))).toBe(4);
		expect(heatmapLevel(completionRatio(3, 3))).toBe(5);
		// C's own streak: the 15th breaks it, the 16th counts once.
		expect(habitStreaks(C, ["2026-10-16"], "2026-10-16", sp)).toMatchObject({
			current: 1,
		});
	});

	it("never counts the pending item on the days it is only overdue", () => {
		let completions = [...base];
		for (
			let date = "2026-10-17";
			date <= "2026-10-31";
			date = addDays(date, 1)
		) {
			completions = [...completions, done("A", date), done("B", date)];
		}
		const days = summary(completions, "2026-10-31");
		for (
			let date = "2026-10-16";
			date <= "2026-10-31";
			date = addDays(date, 1)
		) {
			expect(days.get(date)).toMatchObject({ possible: 2, completed: 2 });
		}
		expect(days.get("2026-10-15")).toMatchObject({ possible: 3, completed: 2 });
		expect(overdueOn(habits, completions, "2026-10-31", sp)).toEqual([]);
	});
});
