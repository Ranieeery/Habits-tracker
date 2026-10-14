import type {
	Completion,
	Habit,
	HabitReschedule,
	Mutation,
} from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { addDays } from "./dates.ts";
import { digestMessage, selectDigestContent } from "./digest.ts";
import { habitActions } from "./habit-actions.ts";
import {
	dayItems,
	overdueLabel,
	pendingTodayCount,
	todayView,
} from "./overdue.ts";
import { completionRatio, heatmapLevel, summarizeDay } from "./progress.ts";
import { previewDayView, previewItems } from "./preview.ts";
import {
	checkReschedule,
	checkRescheduleUndo,
	MAX_RESCHEDULES,
	movedOutLabel,
	orphanedReschedules,
	orphanNotice,
	RESCHEDULE_MAX_DAYS,
	rescheduleAvailability,
	rescheduleBounds,
	rescheduledLabel,
	rescheduleError,
	rescheduleShortcuts,
	rescheduleSummary,
	undoReschedule,
} from "./reschedule.ts";
import {
	isMoveValid,
	NO_RESCHEDULES,
	rescheduleIndex,
} from "./reschedule-index.ts";
import { isHabitPossibleOn, nextOccurrence } from "./schedule.ts";
import { dayStreaks, habitStreaks } from "./streaks.ts";
import {
	applyMutation,
	habitDependency,
	materialize,
	syncState,
} from "./sync.ts";
import { upcoming } from "./upcoming.ts";
import { dayView, summarizeYear } from "./views.ts";

const SP = "America/Sao_Paulo";
const TOKYO = "Asia/Tokyo";
const TODAY = "2026-10-20";

const spAt = (date: string, time = "12:00") =>
	Date.parse(`${date}T${time}:00-03:00`);

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
	return {
		id,
		name: id,
		schedule: { type: "monthly_days", days: [20] },
		start_date: "2026-01-01",
		archived_at: null,
		description: "",
		sort_key: `a${id}`,
		created_at: spAt("2025-12-01", "08:00"),
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

const daily = (id: string) =>
	habit(id, { schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] } });

let seq = 0;
function row(
	habitId: string,
	original: string,
	to: string,
	sequence = 1,
	from = original,
	deleted = false
): HabitReschedule {
	seq += 1;
	return {
		id: `00000000-0000-7000-8000-${String(seq).padStart(12, "0")}`,
		habit_id: habitId,
		original_date: original,
		from_date: from,
		to_date: to,
		sequence,
		created_at: 1,
		updated_at: 1,
		deleted_at: deleted ? 2 : null,
	};
}

type Facts = Pick<Completion, "habit_id" | "date" | "deleted_at">;
const done = (habitId: string, date: string): Facts => ({
	habit_id: habitId,
	date,
	deleted_at: null,
});

function options(rows: HabitReschedule[], completions: Facts[] = []) {
	return {
		timeZone: SP,
		reschedules: rescheduleIndex(rows, completions),
	};
}

const C = habit("c");
const A = daily("a");
const B = daily("b");
const once = habit("o", {
	schedule: { type: "once", date: TODAY },
	start_date: TODAY,
});

function check(
	h: Habit,
	request: {
		original_date?: string;
		from_date?: string;
		to_date: string;
		sequence?: number;
	},
	{
		rows = [] as HabitReschedule[],
		completed = [] as string[],
		today = TODAY,
	} = {}
) {
	return checkReschedule({
		habit: h,
		rows,
		completedDates: completed,
		request: {
			original_date: request.original_date ?? TODAY,
			from_date: request.from_date ?? request.original_date ?? TODAY,
			to_date: request.to_date,
			sequence: request.sequence ?? 1,
		},
		today,
	});
}

describe("constants", () => {
	it("are the agreed limits", () => {
		expect(MAX_RESCHEDULES).toBe(2);
		expect(RESCHEDULE_MAX_DAYS).toBe(90);
	});
});

describe("checkReschedule: the new date", () => {
	it("accepts E + 1 and today + 90 (single date)", () => {
		expect(check(once, { to_date: "2026-10-21" })).toBeNull();
		expect(check(once, { to_date: addDays(TODAY, 90) })).toBeNull();
	});

	it("refuses today + 91, today, E and before E", () => {
		expect(check(once, { to_date: addDays(TODAY, 91) })).toBe("too_far");
		expect(check(once, { to_date: TODAY })).toBe("not_later");
		expect(check(once, { to_date: "2026-10-19" })).toBe("not_later");
		const moved = [row("o", TODAY, "2026-10-25")];
		expect(
			check(
				once,
				{ from_date: "2026-10-25", to_date: "2026-10-25", sequence: 2 },
				{ rows: moved }
			)
		).toBe("not_later");
		expect(
			check(
				once,
				{ from_date: "2026-10-25", to_date: "2026-10-24", sequence: 2 },
				{ rows: moved }
			)
		).toBe("not_later");
		expect(
			check(
				once,
				{ from_date: "2026-10-25", to_date: "2026-10-26", sequence: 2 },
				{ rows: moved }
			)
		).toBeNull();
	});

	it("days of the month: up to the day before the next occurrence", () => {
		expect(check(C, { to_date: "2026-11-19" })).toBeNull();
		expect(check(C, { to_date: "2026-11-20" })).toBe("crosses_next");
		expect(check(C, { to_date: "2026-11-21" })).toBe("crosses_next");
	});

	it("days of the month: several days in the same month", () => {
		const twice = habit("t", {
			schedule: { type: "monthly_days", days: [20, 25] },
		});
		expect(check(twice, { to_date: "2026-10-24" })).toBeNull();
		expect(check(twice, { to_date: "2026-10-25" })).toBe("crosses_next");
		const crowded = habit("x", {
			schedule: { type: "monthly_days", days: [20, 21] },
		});
		expect(check(crowded, { to_date: "2026-10-21" })).toBe("crosses_next");
		expect(
			rescheduleBounds(crowded, { original: TODAY, effective: TODAY }, TODAY)
		).toBeNull();
	});

	it("days of the month: day 31 falls on the last day of a short month", () => {
		const last = habit("l", { schedule: { type: "monthly_days", days: [31] } });
		const today = "2026-11-30"; // November has 30 days
		expect(
			check(last, { original_date: today, to_date: "2026-12-30" }, { today })
		).toBeNull();
		expect(
			check(last, { original_date: today, to_date: "2026-12-31" }, { today })
		).toBe("crosses_next");
		expect(
			check(
				last,
				{ original_date: "2026-11-29", to_date: "2026-12-01" },
				{ today }
			)
		).toBe("not_an_occurrence");
	});

	it("crosses the year", () => {
		const today = "2026-12-20";
		expect(
			check(C, { original_date: today, to_date: "2027-01-19" }, { today })
		).toBeNull();
		expect(
			check(C, { original_date: today, to_date: "2027-01-20" }, { today })
		).toBe("crosses_next");
	});

	it("the bounds follow the closest limit", () => {
		expect(
			rescheduleBounds(C, { original: TODAY, effective: TODAY }, TODAY)
		).toEqual({
			min: "2026-10-21",
			max: "2026-11-19",
			limit: "next",
			next: "2026-11-20",
		});
		expect(
			rescheduleBounds(once, { original: TODAY, effective: TODAY }, TODAY)
		).toEqual({
			min: "2026-10-21",
			max: addDays(TODAY, 90),
			limit: "days",
			next: null,
		});
		// A preview day: the minimum is the day after it.
		const later = habit("p", {
			schedule: { type: "once", date: "2026-10-24" },
			start_date: TODAY,
		});
		expect(
			rescheduleBounds(
				later,
				{ original: "2026-10-24", effective: "2026-10-24" },
				TODAY
			)?.min
		).toBe("2026-10-25");
	});
});

describe("checkReschedule: when it is allowed", () => {
	it("on the day E (it lasts until midnight) and before it", () => {
		expect(check(once, { to_date: "2026-10-22" })).toBeNull();
		const future = habit("f", {
			schedule: { type: "once", date: "2026-10-23" },
			start_date: TODAY,
		});
		expect(
			check(future, { original_date: "2026-10-23", to_date: "2026-10-24" })
		).toBeNull();
	});

	it("never after midnight of E: it is overdue then", () => {
		expect(
			check(once, { to_date: "2026-10-25" }, { today: "2026-10-21" })
		).toBe("occurrence_passed");
	});

	it("only single dates and days of the month", () => {
		for (const schedule of [
			{ type: "weekdays", days: [2] },
			{ type: "interval", every: 2, anchor_date: TODAY },
			{ type: "yearly", month: 10, day: 20 },
			{ type: "deadline", due_date: TODAY },
		] as const) {
			expect(check(habit("k", { schedule }), { to_date: "2026-10-22" })).toBe(
				"not_reschedulable"
			);
		}
	});

	it("not archived, and only on an occurrence", () => {
		expect(
			check(habit("z", { archived_at: spAt(TODAY) }), { to_date: "2026-10-22" })
		).toBe("archived");
		expect(
			check(C, { original_date: "2026-10-21", to_date: "2026-10-22" })
		).toBe("not_an_occurrence");
	});

	it("not when already done", () => {
		expect(check(C, { to_date: "2026-10-22" }, { completed: [TODAY] })).toBe(
			"already_done"
		);
		// Tomorrow (the server's +1) fulfills today's occurrence too.
		expect(
			check(C, { to_date: "2026-10-22" }, { completed: ["2026-10-21"] })
		).toBe("already_done");
		// An older completion does not.
		expect(
			check(C, { to_date: "2026-10-22" }, { completed: ["2026-10-19"] })
		).toBeNull();
	});

	it("at most twice; the third is refused", () => {
		const first = row("c", TODAY, "2026-10-22");
		expect(
			check(
				C,
				{ from_date: "2026-10-22", to_date: "2026-10-25", sequence: 2 },
				{
					rows: [first],
					today: "2026-10-22",
				}
			)
		).toBeNull();
		const second = row("c", TODAY, "2026-10-25", 2, "2026-10-22");
		expect(
			check(
				C,
				{ from_date: "2026-10-25", to_date: "2026-10-27", sequence: 3 },
				{
					rows: [first, second],
					today: "2026-10-25",
				}
			)
		).toBe("limit_reached");
	});

	it("stale when the client saw another state (another device)", () => {
		const first = row("c", TODAY, "2026-10-22");
		expect(check(C, { to_date: "2026-10-23" }, { rows: [first] })).toBe(
			"stale"
		);
	});

	it("an undo gives the slot back", () => {
		const first = row("c", TODAY, "2026-10-22");
		const second = row("c", TODAY, "2026-10-25", 2, "2026-10-22");
		const undone = undoReschedule(second, 5).row;
		expect(
			check(
				C,
				{ from_date: "2026-10-22", to_date: "2026-10-27", sequence: 2 },
				{
					rows: [first, undone],
					today: "2026-10-22",
				}
			)
		).toBeNull();
	});
});

describe("checkRescheduleUndo", () => {
	const first = row("c", TODAY, "2026-10-22");
	const second = row("c", TODAY, "2026-10-25", 2, "2026-10-22");
	it("only the last one, while its previous date is today or later", () => {
		expect(
			checkRescheduleUndo({ habit: C, rows: [first], row: first, today: TODAY })
		).toBeNull();
		expect(
			checkRescheduleUndo({
				habit: C,
				rows: [first, second],
				row: first,
				today: TODAY,
			})
		).toBe("not_last");
		expect(
			checkRescheduleUndo({
				habit: C,
				rows: [first],
				row: first,
				today: "2026-10-21",
			})
		).toBe("undo_passed");
		expect(
			checkRescheduleUndo({
				habit: { archived_at: 1 },
				rows: [first],
				row: first,
				today: TODAY,
			})
		).toBe("archived");
	});

	it("maps problems to API errors", () => {
		expect(rescheduleError("limit_reached").code).toBe("conflict");
		expect(rescheduleError("stale").code).toBe("conflict");
		expect(rescheduleError("too_far").code).toBe("date_out_of_range");
		expect(rescheduleError("already_done")).toMatchObject({
			code: "validation_error",
			details: { reason: "already_done" },
		});
	});
});

describe("counting: the failure moves to N, never on O", () => {
	// A and B daily, C on day 20 postponed from 20/10 to 27/10.
	const habits = [A, B, C];
	const moved = [row("c", TODAY, "2026-10-27")];

	it("done on N: 20/10 is 2 of 2 and 27/10 is 3 of 3", () => {
		const completions = [
			done("a", TODAY),
			done("b", TODAY),
			done("a", "2026-10-27"),
			done("b", "2026-10-27"),
			done("c", "2026-10-27"),
		];
		const opts = options(moved, completions);
		expect(summarizeDay(habits, completions, TODAY, opts)).toEqual({
			possible: 2,
			completed: 2,
		});
		expect(summarizeDay(habits, completions, "2026-10-27", opts)).toEqual({
			possible: 3,
			completed: 3,
		});
		// Without the postponement, 20/10 was 2 of 3 (level 4).
		expect(
			summarizeDay(habits, completions, TODAY, {
				timeZone: SP,
				reschedules: NO_RESCHEDULES,
			})
		).toEqual({ possible: 3, completed: 2 });
		expect(heatmapLevel(completionRatio(2, 2))).toBe(5);
	});

	it("missed on N: 27/10 is 2 of 3, overdue from 28/10, done late counts that day", () => {
		const completions = [done("a", "2026-10-27"), done("b", "2026-10-27")];
		const opts = options(moved, completions);
		expect(summarizeDay(habits, completions, "2026-10-27", opts)).toEqual({
			possible: 3,
			completed: 2,
		});
		const view = todayView(habits, completions, "2026-10-28", opts);
		expect(view.overdue).toEqual([
			{
				habit: C,
				since: "2026-10-27",
				completed_today: false,
				rescheduled_from: TODAY,
			},
		]);
		expect(overdueLabel("2026-10-27", "2026-10-28", TODAY)).toEqual({
			text: "Atrasado desde 27/10 · adiado",
			spoken: "atrasado desde 27 de outubro, adiado de 20 de outubro",
		});
		// Overdue counted from N: the last day is N + 15.
		expect(todayView(habits, [], "2026-11-11", opts).overdue).toHaveLength(1);
		expect(todayView(habits, [], "2026-11-12", opts).overdue).toHaveLength(0);
		// Marked on 30/10: counts on 30/10 and 27/10 keeps its failure.
		const late = [...completions, done("c", "2026-10-30")];
		const lateOpts = options(moved, late);
		expect(summarizeDay(habits, late, "2026-10-27", lateOpts)).toEqual({
			possible: 3,
			completed: 2,
		});
		expect(summarizeDay(habits, late, "2026-10-30", lateOpts)).toEqual({
			possible: 3,
			completed: 1,
		});
		expect(todayView(habits, late, "2026-10-31", lateOpts).overdue).toEqual([]);
	});

	it("the fulfillment window starts at O: done between O and E settles it early", () => {
		// Marked on 22/10 (an older app still listing it on 20/10, or a race).
		const completions = [done("c", "2026-10-22")];
		const opts = options(moved, completions);
		expect(isHabitPossibleOn(C, "2026-10-27", opts)).toBe(false);
		expect(summarizeDay(habits, completions, "2026-10-22", opts)).toEqual({
			possible: 3,
			completed: 1,
		});
		expect(todayView(habits, completions, "2026-10-28", opts).overdue).toEqual(
			[]
		);
	});

	it("an overdue window ends before the next nominal occurrence", () => {
		// November's occurrence missed; December's postponed to 25/12.
		const opts = options([row("c", "2026-12-20", "2026-12-25")]);
		expect(todayView([C], [], "2026-11-30", opts).overdue).toHaveLength(1);
		// On 20/12 (the next nominal date) November's overdue item ends.
		expect(todayView([C], [], "2026-12-20", opts).overdue).toEqual([]);
		expect(todayView([C], [], "2026-12-20", opts).possible_habits).toEqual([]);
	});

	it("streaks of strong days cross O and break on a missed N", () => {
		const completions: Facts[] = [];
		for (let d = "2026-10-15"; d <= "2026-10-30"; d = addDays(d, 1)) {
			completions.push(done("a", d), done("b", d));
		}
		const summary = (rows: HabitReschedule[]) =>
			summarizeYear(habits, completions, {
				year: 2026,
				today: "2026-10-30",
				...options(rows, completions),
			}).filter((day) => day.date >= "2026-10-15");
		const plain = summary([]);
		const movedSummary = summary(moved);
		expect(plain.find((d) => d.date === TODAY)).toMatchObject({ possible: 3 });
		expect(movedSummary.find((d) => d.date === TODAY)).toMatchObject({
			possible: 2,
			completed: 2,
		});
		expect(movedSummary.find((d) => d.date === "2026-10-27")).toMatchObject({
			possible: 3,
			completed: 2,
		});
		// The habit's own streak: the occurrence failed on 27/10, not 20/10.
		expect(habitStreaks(C, [], "2026-10-30", options(moved)).current).toBe(0);
		expect(dayStreaks(movedSummary, "2026-10-30").longest).toBeGreaterThan(
			dayStreaks(plain, "2026-10-30").longest
		);
	});

	it("the reminder and the 09:00 digest follow the effective date", () => {
		const onO = selectDigestContent(habits, [], TODAY, options(moved));
		expect(onO.todayTotal).toBe(2);
		expect(pendingTodayCount(habits, [], TODAY, options(moved))).toBe(2);
		const onN = selectDigestContent(habits, [], "2026-10-27", options(moved));
		expect(onN.todayTotal).toBe(3);
		expect(onN.highlights).toContain("c");
		// A single date tomorrow: listed on the day before its new date.
		const consulta = habit("consulta", {
			schedule: { type: "once", date: "2026-10-21" },
			start_date: "2026-10-01",
		});
		const away = options([row("consulta", "2026-10-21", "2026-10-28")]);
		expect(selectDigestContent([consulta], [], TODAY, away).tomorrow).toEqual(
			[]
		);
		const before = selectDigestContent([consulta], [], "2026-10-27", away);
		expect(before.tomorrow).toEqual(["consulta"]);
		expect(digestMessage(before, true).body).toContain("Amanhã: consulta.");
	});

	it("time zones: the archive cutoff applies to the effective date", () => {
		const archived = habit("c", {
			archived_at: Date.parse("2026-10-24T20:00:00Z"),
		});
		const opts = { timeZone: TOKYO, reschedules: rescheduleIndex(moved, []) };
		// 25/10 in Tokyo: the occurrence on 27/10 is after the archive day.
		expect(isHabitPossibleOn(archived, "2026-10-27", opts)).toBe(false);
		// Its nominal day never fails again.
		expect(isHabitPossibleOn(archived, TODAY, opts)).toBe(false);
	});
});

describe("views", () => {
	const moved = [row("c", TODAY, "2026-10-27")];

	it("lists it on N with the badge and leaves a note on O", () => {
		const opts = options(moved);
		const onN = dayView([A, C], [], "2026-10-27", opts);
		expect(onN.moved_in).toEqual([
			{ habit_id: "c", original_date: TODAY, count: 1 },
		]);
		const items = dayItems(onN).items;
		expect(items.find((item) => item.habit.id === "c")).toMatchObject({
			rescheduledFrom: TODAY,
			rescheduleCount: 1,
		});
		const onO = dayItems(todayView([A, C], [], TODAY, opts));
		expect(onO.items.map((item) => item.habit.id)).toEqual(["a"]);
		expect(onO.movedOut).toEqual([{ habit: C, toDate: "2026-10-27" }]);
		expect(rescheduledLabel(TODAY, "2026-10-27")).toEqual({
			text: "Adiado de 20/10",
			spoken: "adiado de 20 de outubro",
		});
		expect(movedOutLabel("2026-10-27", TODAY).text).toBe("Adiado para 27/10");
	});

	it("the 7-day preview shows it on N", () => {
		const opts = options(moved);
		const day = previewDayView([A, C], {}, "2026-10-27", opts);
		expect(
			previewItems(day).map((item) => [item.habit.id, item.rescheduledFrom])
		).toEqual([
			["a", undefined],
			["c", TODAY],
		]);
		expect(previewDayView([A, C], {}, TODAY, opts).possible_habits).toEqual([
			A,
		]);
	});

	it("'Próximos' and the next occurrence use the effective date", () => {
		const opts = options(moved);
		expect(nextOccurrence(C, TODAY, opts)).toBe("2026-10-27");
		expect(
			upcoming([C], "2026-10-19", { ...opts, days: 14 }).map(
				(item) => item.date
			)
		).toEqual(["2026-10-27"]);
	});
});

describe("orphans", () => {
	const moved = [row("c", TODAY, "2026-10-27")];

	it("a postponement whose nominal date is no longer an occurrence is ignored", () => {
		const edited = habit("c", {
			schedule: { type: "monthly_days", days: [5] },
		});
		const opts = options(moved);
		expect(isHabitPossibleOn(edited, "2026-10-27", opts)).toBe(false);
		expect(isHabitPossibleOn(edited, "2026-11-05", opts)).toBe(true);
		const orphans = orphanedReschedules(C, edited, opts.reschedules);
		expect(orphans.map((move) => move.original)).toEqual([TODAY]);
		expect(orphanNotice(orphans, edited, TODAY)).toBe(
			"1 adiamento deixa de valer: 27/10 deixa de ter esta ocorrência."
		);
		// Editing back makes it valid again (nothing was deleted).
		expect(isHabitPossibleOn(C, "2026-10-27", opts)).toBe(true);
	});

	it("days of the month: a new day before E orphans it and says the failure may return", () => {
		const edited = habit("c", {
			schedule: { type: "monthly_days", days: [20, 25] },
		});
		expect(
			isMoveValid(edited, { original: TODAY, effective: "2026-10-27" })
		).toBe(false);
		const orphans = orphanedReschedules(C, edited, options(moved).reschedules);
		expect(orphanNotice(orphans, edited, TODAY)).toContain(
			"volta para o dia original"
		);
	});

	it("a single date edited to another day orphans it", () => {
		const consulta = habit("o", {
			schedule: { type: "once", date: TODAY },
			start_date: TODAY,
		});
		const opts = options([row("o", TODAY, "2026-10-25")]);
		const edited = {
			...consulta,
			schedule: { type: "once", date: "2026-10-30" },
		} as Habit;
		expect(isHabitPossibleOn(edited, "2026-10-25", opts)).toBe(false);
		expect(isHabitPossibleOn(edited, "2026-10-30", opts)).toBe(true);
	});
});

describe("the menu item and the dialog", () => {
	const base = {
		date: TODAY,
		today: TODAY,
		overdue: false,
		done: false,
		rescheduledFrom: null,
		count: 0,
	};

	it("shows on today and the preview, never on past days, overdue rows or done ones", () => {
		expect(rescheduleAvailability(C, base)).toEqual({ state: "enabled" });
		// A preview day where the occurrence lives.
		expect(
			rescheduleAvailability(C, { ...base, date: "2026-10-25" }).state
		).toBe("enabled");
		expect(
			rescheduleAvailability(once, { ...base, date: "2026-10-19" }).state
		).toBe("hidden");
		expect(rescheduleAvailability(C, { ...base, overdue: true }).state).toBe(
			"hidden"
		);
		expect(rescheduleAvailability(C, { ...base, done: true }).state).toBe(
			"hidden"
		);
		expect(rescheduleAvailability(A, base).state).toBe("hidden");
	});

	it("disabled with the reason at the limit", () => {
		const availability = rescheduleAvailability(C, {
			...base,
			date: "2026-10-27",
			rescheduledFrom: TODAY,
			count: 2,
		});
		expect(availability).toEqual({
			state: "disabled",
			reason: "Limite de 2 adiamentos atingido",
		});
		expect(
			habitActions(C, availability).find((action) => action.id === "reschedule")
		).toMatchObject({ disabledReason: "Limite de 2 adiamentos atingido" });
		expect(habitActions(C).map((action) => action.id)).not.toContain(
			"reschedule"
		);
		expect(
			habitActions(C, { state: "enabled" }, { archive: false }).map(
				(action) => action.id
			)
		).toEqual(["edit", "reschedule"]);
		expect(
			habitActions(C, { state: "enabled" }).map((action) => action.id)
		).toEqual(["edit", "reschedule", "archive"]);
	});

	it("shortcuts from today and from a later day, invalid ones disabled", () => {
		const bounds = rescheduleBounds(
			C,
			{ original: "2026-11-20", effective: "2026-11-20" },
			"2026-11-15"
		)!;
		expect(rescheduleShortcuts("2026-11-20", "2026-11-15", bounds)).toEqual([
			{ label: "Dia seguinte", date: "2026-11-21", disabledReason: null },
			{ label: "Uma semana depois", date: "2026-11-27", disabledReason: null },
		]);
		const tight = rescheduleBounds(
			habit("t", { schedule: { type: "monthly_days", days: [20, 25] } }),
			{ original: TODAY, effective: TODAY },
			TODAY
		)!;
		expect(rescheduleShortcuts(TODAY, TODAY, tight)).toEqual([
			{ label: "Amanhã", date: "2026-10-21", disabledReason: null },
			{
				label: "Daqui a 1 semana",
				date: "2026-10-27",
				disabledReason: "Passa da próxima ocorrência (25/10)",
			},
		]);
	});

	it("summarizes the effect before confirming", () => {
		expect(
			rescheduleSummary({
				effective: "2026-11-20",
				to: "2026-11-27",
				count: 0,
				today: TODAY,
			})
		).toEqual({
			effect:
				"O dia 20/11 deixa de contar este hábito (sem falha). Passa para 27/11.",
			remaining: "Resta 1 adiamento.",
			last: false,
		});
		expect(
			rescheduleSummary({
				effective: "2026-11-27",
				to: "2026-11-28",
				count: 1,
				today: TODAY,
			})
		).toMatchObject({
			remaining: "Este é o último adiamento desta ocorrência.",
			last: true,
		});
	});
});

describe("sync: reschedule.create and reschedule.undo", () => {
	const consulta = habit("00000000-0000-7000-8000-00000000c0c0", {
		schedule: { type: "once", date: TODAY },
		start_date: "2026-10-01",
	});
	const mutation = (overrides: Record<string, unknown> = {}) =>
		({
			mutation_id: "00000000-0000-7000-8000-0000000000a1",
			created_at: 1,
			type: "reschedule.create",
			id: "00000000-0000-7000-8000-0000000000b1",
			habit_id: consulta.id,
			original_date: TODAY,
			from_date: TODAY,
			to_date: "2026-10-27",
			sequence: 1,
			action_date: TODAY,
			...overrides,
		}) as Mutation;
	const ctx = (today?: string) => ({ now: 100, today, newId: () => "x" });

	it("applies once; the same id again changes nothing", () => {
		const state = syncState([consulta], []);
		expect(applyMutation(state, mutation(), ctx(TODAY))).toEqual({
			status: "applied",
			canonical_id: "00000000-0000-7000-8000-0000000000b1",
			changed: true,
		});
		expect(applyMutation(state, mutation(), ctx(TODAY))).toMatchObject({
			status: "applied",
			changed: false,
		});
		expect([...state.reschedules.values()]).toHaveLength(1);
	});

	it("an offline postponement is checked against the day it was made", () => {
		// Made on 20/10 offline, synced on 21/10 (E already went by then).
		const state = syncState([consulta], []);
		expect(applyMutation(state, mutation(), ctx("2026-10-21")).status).toBe(
			"applied"
		);
		// Outside BACKFILL_DAYS of the server's today it is refused.
		const late = syncState([consulta], []);
		expect(applyMutation(late, mutation(), ctx("2026-11-25"))).toMatchObject({
			status: "rejected",
			error: { code: "date_out_of_range" },
		});
	});

	it("two devices postponing the same occurrence: the second is a conflict", () => {
		const state = syncState([consulta], []);
		applyMutation(state, mutation(), ctx(TODAY));
		const other = mutation({
			mutation_id: "00000000-0000-7000-8000-0000000000a2",
			id: "00000000-0000-7000-8000-0000000000b2",
			to_date: "2026-10-30",
		});
		expect(applyMutation(state, other, ctx(TODAY))).toMatchObject({
			status: "rejected",
			error: { code: "conflict", details: { reason: "stale" } },
		});
	});

	it("an unknown or deleted habit is not_found; the limit is a conflict", () => {
		expect(
			applyMutation(syncState([], []), mutation(), ctx(TODAY))
		).toMatchObject({ status: "rejected", error: { code: "not_found" } });
		const state = syncState(
			[consulta],
			[],
			[
				row(consulta.id, TODAY, "2026-10-22"),
				row(consulta.id, TODAY, "2026-10-25", 2, "2026-10-22"),
			]
		);
		expect(
			applyMutation(
				state,
				mutation({
					from_date: "2026-10-25",
					sequence: 3,
					action_date: "2026-10-25",
				}),
				ctx("2026-10-25")
			)
		).toMatchObject({
			status: "rejected",
			error: { code: "conflict", details: { reason: "limit_reached" } },
		});
	});

	it("undo tombstones the last row, once", () => {
		const state = syncState([consulta], []);
		applyMutation(state, mutation(), ctx(TODAY));
		const undo = {
			mutation_id: "00000000-0000-7000-8000-0000000000a3",
			created_at: 1,
			type: "reschedule.undo",
			habit_id: consulta.id,
			reschedule_id: "00000000-0000-7000-8000-0000000000b1",
			action_date: TODAY,
		} as Mutation;
		expect(applyMutation(state, undo, ctx(TODAY))).toMatchObject({
			status: "applied",
			changed: true,
		});
		expect(
			state.reschedules.get("00000000-0000-7000-8000-0000000000b1")?.deleted_at
		).toBe(100);
		expect(applyMutation(state, undo, ctx(TODAY))).toMatchObject({
			status: "applied",
			changed: false,
		});
		// After the day, undoing would put a failure back on a past day.
		const later = syncState([consulta], []);
		applyMutation(later, mutation(), ctx(TODAY));
		expect(
			applyMutation(
				later,
				{ ...undo, action_date: "2026-10-21" } as Mutation,
				ctx("2026-10-21")
			)
		).toMatchObject({
			status: "rejected",
			error: { details: { reason: "undo_passed" } },
		});
	});

	it("materialize replays pending postponements over the mirror", () => {
		const state = materialize(
			{ habits: [consulta], completions: [], reschedules: [] },
			[mutation()],
			{ now: 1, newId: () => "x" }
		);
		const opts = {
			timeZone: SP,
			reschedules: rescheduleIndex(state.reschedules.values(), []),
		};
		expect(isHabitPossibleOn(consulta, TODAY, opts)).toBe(false);
		expect(isHabitPossibleOn(consulta, "2026-10-27", opts)).toBe(true);
		expect(habitDependency(mutation())).toBe(consulta.id);
	});
});
