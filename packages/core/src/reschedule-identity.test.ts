// 2.16.0: every rule that reads "possible on a date" now takes the user's
// postponed occurrences. Without postponements (or with only rows that do not
// apply: orphans, tombstones, other habits) every result must be identical
// to what the same function gives with `NO_RESCHEDULES`, the behavior before.
import type { Completion, Habit, HabitReschedule } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { addDays, eachDay } from "./dates.ts";
import { selectDigestContent } from "./digest.ts";
import { overdueOn, pendingTodayCount, todayView } from "./overdue.ts";
import { previewDayView } from "./preview.ts";
import { NO_RESCHEDULES, rescheduleIndex } from "./reschedule-index.ts";
import {
	isHabitPossibleOn,
	nextOccurrence,
	occurrencesBetween,
	type ScheduleOptions,
} from "./schedule.ts";
import { habitStreaks } from "./streaks.ts";
import { upcoming } from "./upcoming.ts";
import { dayView, summarizeYear } from "./views.ts";

const ZONES = ["America/Sao_Paulo", "Asia/Tokyo", "Pacific/Honolulu"];

function habit(
	id: string,
	schedule: Habit["schedule"],
	overrides: Partial<Habit> = {}
): Habit {
	return {
		id,
		name: id,
		description: "",
		schedule,
		start_date: "2025-03-01",
		archived_at: null,
		sort_key: `a${id}`,
		created_at: Date.UTC(2025, 1, 1),
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

const habits: Habit[] = [
	habit("w", { type: "weekdays", days: [1, 3, 5] }),
	habit("i", { type: "interval", every: 3, anchor_date: "2025-03-02" }),
	habit("m", { type: "monthly_days", days: [5, 20, 31] }),
	habit("o", { type: "once", date: "2026-06-10" }),
	habit("y", { type: "yearly", month: 2, day: 29 }),
	habit("d", { type: "deadline", due_date: "2026-04-15" }),
	habit(
		"a",
		{ type: "monthly_days", days: [10] },
		{
			archived_at: Date.UTC(2026, 3, 1),
		}
	),
	habit("x", { type: "monthly_days", days: [12] }, { deleted_at: 5 }),
];

type Facts = Pick<Completion, "habit_id" | "date" | "deleted_at">;
const completions: Facts[] = [];
for (const date of eachDay("2025-03-01", "2026-12-31")) {
	for (const h of habits) {
		const n = Number(date.slice(8)) + h.id.charCodeAt(0);
		if (n % 3 === 0)
			completions.push({ habit_id: h.id, date, deleted_at: null });
		else if (n % 11 === 0)
			completions.push({ habit_id: h.id, date, deleted_at: 9 });
	}
}

let seq = 0;
function row(
	habitId: string,
	original: string,
	to: string,
	deleted = false
): HabitReschedule {
	seq += 1;
	return {
		id: `00000000-0000-7000-8000-${String(seq).padStart(12, "0")}`,
		habit_id: habitId,
		original_date: original,
		from_date: original,
		to_date: to,
		sequence: 1,
		created_at: 1,
		updated_at: 1,
		deleted_at: deleted ? 2 : null,
	};
}

/** Rows that must change nothing. */
const inert: HabitReschedule[] = [
	row("m", "2026-05-06", "2026-05-08"), // not an occurrence of [5, 20, 31]
	row("m", "2026-05-05", "2026-05-25"), // crosses the 20th: orphan
	row("m", "2026-07-20", "2026-07-22", true), // tombstone
	row("w", "2026-05-04", "2026-05-06"), // weekdays: never applies
	row("y", "2026-02-28", "2026-03-02"), // yearly: never applies
	row("d", "2026-04-15", "2026-04-20"), // deadline: never applies
	row("o", "2026-06-11", "2026-06-12"), // not the single date
	row("ghost", "2026-05-05", "2026-05-07"), // unknown habit
];

const indexes: [string, (zone: string) => ScheduleOptions][] = [
	[
		"an empty index",
		(timeZone) => ({ timeZone, reschedules: rescheduleIndex([], completions) }),
	],
	[
		"only rows that do not apply",
		(timeZone) => ({
			timeZone,
			reschedules: rescheduleIndex(inert, completions),
		}),
	],
];

const base = (timeZone: string): ScheduleOptions => ({
	timeZone,
	reschedules: NO_RESCHEDULES,
});

describe.each(ZONES)("identical without postponements (%s)", (zone) => {
	describe.each(indexes)("with %s", (_, options) => {
		const opts = options(zone);
		const plain = base(zone);

		it("isHabitPossibleOn, nextOccurrence and occurrencesBetween", () => {
			for (const date of eachDay("2025-03-01", "2026-12-31")) {
				for (const h of habits) {
					expect(isHabitPossibleOn(h, date, opts)).toBe(
						isHabitPossibleOn(h, date, plain)
					);
				}
			}
			for (const h of habits) {
				for (const from of ["2025-03-01", "2026-01-15", "2026-05-01"]) {
					expect(nextOccurrence(h, from, opts)).toBe(
						nextOccurrence(h, from, plain)
					);
				}
				expect(occurrencesBetween(h, "2026-01-01", "2026-12-31", opts)).toEqual(
					occurrencesBetween(h, "2026-01-01", "2026-12-31", plain)
				);
			}
		});

		it("year summaries (ratios, heatmap levels, overview, insights read them)", () => {
			for (const year of [2025, 2026]) {
				expect(
					summarizeYear(habits, completions, {
						year,
						today: "2026-12-31",
						...opts,
					})
				).toEqual(
					summarizeYear(habits, completions, {
						year,
						today: "2026-12-31",
						...plain,
					})
				);
			}
		});

		it("day views, today, overdue, reminder, digest and the preview", () => {
			for (const date of eachDay("2026-01-01", "2026-08-31")) {
				expect(dayView(habits, completions, date, opts)).toEqual(
					dayView(habits, completions, date, plain)
				);
				expect(todayView(habits, completions, date, opts)).toEqual(
					todayView(habits, completions, date, plain)
				);
				expect(overdueOn(habits, completions, date, opts)).toEqual(
					overdueOn(habits, completions, date, plain)
				);
				expect(pendingTodayCount(habits, completions, date, opts)).toBe(
					pendingTodayCount(habits, completions, date, plain)
				);
				expect(selectDigestContent(habits, completions, date, opts)).toEqual(
					selectDigestContent(habits, completions, date, plain)
				);
				const next = addDays(date, 3);
				expect(previewDayView(habits, {}, next, opts)).toEqual(
					previewDayView(habits, {}, next, plain)
				);
			}
		});

		it("streaks and 'Próximos'", () => {
			for (const h of habits) {
				const dates = completions
					.filter((c) => c.habit_id === h.id && c.deleted_at === null)
					.map((c) => c.date);
				expect(habitStreaks(h, dates, "2026-08-31", opts)).toEqual(
					habitStreaks(h, dates, "2026-08-31", plain)
				);
			}
			for (const today of ["2026-01-10", "2026-05-01", "2026-06-01"]) {
				expect(upcoming(habits, today, { ...opts, days: 14 })).toEqual(
					upcoming(habits, today, { ...plain, days: 14 })
				);
			}
		});
	});
});
