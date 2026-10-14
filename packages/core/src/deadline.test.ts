// Deadline tasks (2.13.0): done before, on or after the due date, only the
// first completion counting, the overdue window, labels, the "Com prazo"
// list and validation, with no double counting anywhere.
import type { Completion, Habit } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import {
	deadlineDoneLabel,
	deadlineLabel,
	deadlineOn,
	firstCompletions,
	isDeadlineSettled,
} from "./deadline.ts";
import { selectDigestContent, digestMessage } from "./digest.ts";
import {
	buildFromDraft,
	DEADLINE_LOCKED,
	draftFromHabit,
	emptyDraft,
} from "./habit-draft.ts";
import {
	dayItems,
	extrasOnlyText,
	overdueOn,
	pendingTodayCount,
	todayView,
} from "./overdue.ts";
import { overviewStats } from "./overview.ts";
import { summarizeDay } from "./progress.ts";
import { checkHabitDates, countOn, nextOccurrence } from "./schedule.ts";
import {
	formatSchedule,
	newHabitNotice,
	repeatSummary,
} from "./schedule-text.ts";
import { dayStreaks, habitStreaks } from "./streaks.ts";
import { upcoming } from "./upcoming.ts";
import { dayView, summarizeYear } from "./views.ts";

const TZ = { timeZone: "America/Sao_Paulo" };

let counter = 0;
const uuid = () =>
	`00000000-0000-7000-8000-${String(++counter).padStart(12, "0")}`;

function task(due: string, overrides: Partial<Habit> = {}): Habit {
	return {
		id: "00000000-0000-7000-8000-00000000d001",
		name: "Entregar relatório",
		description: "",
		schedule: { type: "deadline", due_date: due },
		start_date: "2026-10-01",
		archived_at: null,
		sort_key: "a2",
		created_at: Date.UTC(2026, 9, 1, 12),
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

function daily(id: string, name: string, sort_key: string): Habit {
	return {
		id,
		name,
		description: "",
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-09-01",
		archived_at: null,
		sort_key,
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
	};
}

const A = daily("00000000-0000-7000-8000-00000000a001", "Ler", "a0");
const B = daily("00000000-0000-7000-8000-00000000b001", "Correr", "a1");

function done(
	habit: Habit | string,
	date: string,
	deleted = false
): Completion {
	return {
		id: uuid(),
		habit_id: typeof habit === "string" ? habit : habit.id,
		date,
		completed_at: 1,
		created_at: 1,
		updated_at: 1,
		deleted_at: deleted ? 2 : null,
	};
}

const D = "2026-10-20";

describe("counting a deadline task", () => {
	it("done before the due date: done and possible that day, nothing on D", () => {
		const t = task(D);
		const completions = [done(A, "2026-10-12"), done(t, "2026-10-12")];
		// 1 of 2 without the task would be 1 of 2; with it, 2 of 3.
		expect(summarizeDay([A, B, t], completions, "2026-10-12", TZ)).toEqual({
			possible: 3,
			completed: 2,
		});
		expect(summarizeDay([A, B, t], completions, D, TZ)).toEqual({
			possible: 2,
			completed: 0,
		});
	});

	it("keeps a 100% day at 100%", () => {
		const t = task(D);
		const completions = [
			done(A, "2026-10-12"),
			done(B, "2026-10-12"),
			done(t, "2026-10-12"),
		];
		expect(summarizeDay([A, B, t], completions, "2026-10-12", TZ)).toEqual({
			possible: 3,
			completed: 3,
		});
	});

	it("open before the due date: out of the denominator", () => {
		const t = task(D);
		for (const date of ["2026-10-01", "2026-10-10", "2026-10-19"]) {
			expect(summarizeDay([A, t], [], date, TZ)).toEqual({
				possible: 1,
				completed: 0,
			});
			expect(countOn(t, date, false, TZ, null)).toEqual({
				counted: false,
				done: false,
			});
		}
	});

	it("open on the due date: possible and not done", () => {
		expect(countOn(task(D), D, false, TZ, null)).toEqual({
			counted: true,
			done: false,
		});
		expect(summarizeDay([A, task(D)], [done(A, D)], D, TZ)).toEqual({
			possible: 2,
			completed: 1,
		});
	});

	it("done exactly on the due date", () => {
		const t = task(D);
		expect(summarizeDay([t], [done(t, D)], D, TZ)).toEqual({
			possible: 1,
			completed: 1,
		});
	});

	it("done late (D+1, D+15): D keeps the failure, the late day counts done", () => {
		const t = task(D);
		for (const late of ["2026-10-21", "2026-11-04"]) {
			const completions = [done(t, late)];
			expect(summarizeDay([t], completions, D, TZ)).toEqual({
				possible: 1,
				completed: 0,
			});
			expect(summarizeDay([t], completions, late, TZ)).toEqual({
				possible: 1,
				completed: 1,
			});
		}
	});

	it("counts only the first completion; un-checking it promotes the next", () => {
		const t = task(D);
		const first = done(t, "2026-10-05");
		const extra = done(t, "2026-10-08");
		expect(summarizeDay([t], [first, extra], "2026-10-08", TZ)).toEqual({
			possible: 0,
			completed: 0,
		});
		expect(summarizeDay([t], [first, extra], "2026-10-05", TZ)).toEqual({
			possible: 1,
			completed: 1,
		});
		const unchecked = { ...first, deleted_at: 9 };
		expect(summarizeDay([t], [unchecked, extra], "2026-10-08", TZ)).toEqual({
			possible: 1,
			completed: 1,
		});
		// Without any live completion it is open again (a failure on D).
		expect(
			summarizeDay([t], [unchecked, { ...extra, deleted_at: 9 }], D, TZ)
		).toEqual({ possible: 1, completed: 0 });
	});

	it("leaves an archived task out after it was archived", () => {
		const archived = task(D, { archived_at: Date.UTC(2026, 9, 18, 15) });
		expect(summarizeDay([archived], [], D, TZ).possible).toBe(0);
		expect(deadlineOn([archived], new Map(), "2026-10-15")).toEqual([]);
		expect(overdueOn([archived], [], "2026-10-21", TZ)).toEqual([]);
	});

	it("a task due today, the last day of a month, Feb 29 and across the year", () => {
		for (const due of ["2026-10-31", "2028-02-29"]) {
			const t = task(due, { start_date: "2026-10-01" });
			expect(countOn(t, due, false, TZ, null).counted).toBe(true);
			expect(nextOccurrence(t, "2026-10-15", TZ)).toBe(
				due === "2026-10-31" ? due : null // beyond MAX_LOOKAHEAD_DAYS
			);
		}
		// Done in December, due in January: the new year's summary has no
		// failure on the due date (the first completion is in the old year).
		const t = task("2027-01-10", { start_date: "2026-12-01" });
		const completions = [done(t, "2026-12-20")];
		const jan = summarizeYear([t], completions, {
			year: 2027,
			today: "2027-01-31",
			...TZ,
		});
		expect(jan).toEqual([]);
		const dec = summarizeYear([t], completions, {
			year: 2026,
			today: "2027-01-31",
			...TZ,
		});
		expect(dec).toEqual([{ date: "2026-12-20", possible: 1, completed: 1 }]);
	});

	it("does not depend on the time zone for calendar dates", () => {
		const t = task(D);
		for (const timeZone of ["Asia/Tokyo", "Pacific/Honolulu", "UTC"]) {
			expect(countOn(t, D, false, { timeZone }, null).counted).toBe(true);
			expect(countOn(t, "2026-10-19", false, { timeZone }, null).counted).toBe(
				false
			);
		}
	});
});

describe("no double counting in views and streaks", () => {
	const t = task(D);
	const completions = [
		done(A, "2026-10-12"),
		done(t, "2026-10-12"),
		done(t, "2026-10-14"), // extra
		done(A, D),
	];
	const days = summarizeYear([A, t], completions, {
		year: 2026,
		today: "2026-10-25",
		...TZ,
	});

	it("counts the task once in the year (on its first completion)", () => {
		const total = days.reduce((sum, day) => sum + day.completed, 0);
		expect(total).toBe(3); // A on 12 and 20, the task on 12
		expect(days.find((day) => day.date === "2026-10-12")).toEqual({
			date: "2026-10-12",
			possible: 2,
			completed: 2,
		});
		expect(days.find((day) => day.date === "2026-10-14")?.possible).toBe(1);
		expect(days.find((day) => day.date === D)).toEqual({
			date: D,
			possible: 1,
			completed: 1,
		});
	});

	it("gives the task a streak of 1, and a miss of 0", () => {
		expect(
			habitStreaks(t, ["2026-10-12", "2026-10-14"], "2026-10-25", TZ)
		).toEqual({ current: 1, longest: 1 });
		expect(habitStreaks(t, [], "2026-10-25", TZ)).toEqual({
			current: 0,
			longest: 0,
		});
	});

	it("a missed due date can break a run of strong days; a timely one cannot", () => {
		// Seen the next day: an open today never breaks a run, a past day does.
		const after = "2026-10-21";
		const missed = summarizeYear(
			[A, t],
			[done(A, "2026-10-19"), done(A, D), done(A, after)],
			{ year: 2026, today: after, ...TZ }
		);
		// D is 1 of 2 (50%): the run of strong days ends there.
		expect(missed.find((day) => day.date === D)).toMatchObject({
			possible: 2,
			completed: 1,
		});
		expect(dayStreaks(missed, after).current).toBe(1);
		expect(
			overviewStats({ days: missed, today: after, year: 2026 }).current_streak
		).toBe(1);
		const inTime = summarizeYear(
			[A, t],
			[done(A, "2026-10-19"), done(t, "2026-10-19"), done(A, D)],
			{ year: 2026, today: D, ...TZ }
		);
		expect(dayStreaks(inTime, D).current).toBe(2);
	});
});

describe("overdue after the due date", () => {
	const t = task(D);

	it("is overdue from D+1 to D+15, then leaves the list", () => {
		for (const today of ["2026-10-21", "2026-11-04"]) {
			expect(overdueOn([t], [], today, TZ)).toEqual([
				{ habit: t, since: D, completedToday: false },
			]);
		}
		expect(overdueOn([t], [], "2026-11-05", TZ)).toEqual([]);
	});

	it("is not overdue when done before or on the due date, or late before today", () => {
		for (const date of ["2026-10-10", D, "2026-10-22"]) {
			expect(overdueOn([t], [done(t, date)], "2026-10-23", TZ)).toEqual([]);
		}
	});

	it("marked today: listed checked, and the reminder stops counting it", () => {
		const completions = [done(t, "2026-10-23")];
		expect(overdueOn([t], completions, "2026-10-23", TZ)).toEqual([
			{ habit: t, since: D, completedToday: true },
		]);
		expect(pendingTodayCount([t], [], "2026-10-23", TZ)).toBe(1);
		expect(pendingTodayCount([t], completions, "2026-10-23", TZ)).toBe(0);
	});
});

describe("today's list (Com prazo)", () => {
	const soon = task("2026-10-17", {
		id: "00000000-0000-7000-8000-00000000d002",
		name: "Consulta",
	});
	const later = task(D);
	const today = "2026-10-15";

	it("lists open tasks by due date, a task done today checked, not one done before", () => {
		const first = firstCompletions([done(later, today)]);
		expect(
			deadlineOn([later, soon], first, today).map((item) => [
				item.habit.name,
				item.completedToday,
			])
		).toEqual([
			["Consulta", false],
			["Entregar relatório", true],
		]);
		const before = firstCompletions([done(later, "2026-10-14")]);
		expect(deadlineOn([later], before, today)).toEqual([]);
		// Not started yet, or past its due date: not listed.
		expect(
			deadlineOn([task(D, { start_date: "2026-10-16" })], new Map(), today)
		).toEqual([]);
		expect(deadlineOn([task("2026-10-14")], new Map(), today)).toEqual([]);
	});

	it("builds the rows and the progress like summarizeDay", () => {
		const day = todayView([A, later, soon], [done(A, today)], today, TZ);
		const { items, progress } = dayItems(day);
		expect(items.map((item) => [item.habit.name, item.dueDate])).toEqual([
			["Ler", null],
			["Consulta", "2026-10-17"],
			["Entregar relatório", D],
		]);
		expect(progress).toEqual({ possible: 1, completed: 1 });
		expect(progress).toEqual(
			summarizeDay([A, later, soon], [done(A, today)], today, TZ)
		);
		// Marking a task before its due date: 1 of 1 becomes 2 of 2.
		const marked = dayItems({
			...day,
			completed_habit_ids: [...day.completed_habit_ids, later.id],
		});
		expect(marked.progress).toEqual({ possible: 2, completed: 2 });
	});

	it("counts a task due today in the denominator", () => {
		const dueToday = task(today);
		const { items, progress } = dayItems(
			todayView([A, dueToday], [], today, TZ)
		);
		expect(items.map((item) => item.dueDate)).toEqual([null, today]);
		expect(progress).toEqual({ possible: 2, completed: 0 });
	});

	it("shows nothing for deadline tasks on past and future days but F and D", () => {
		expect(dayView([later], [], "2026-10-18", TZ).possible_habits).toEqual([]);
		expect(dayView([later], [], "2026-10-25", TZ).possible_habits).toEqual([]);
		expect(dayView([later], [], D, TZ).possible_habits).toEqual([later]);
		expect(dayView([later], [], D, TZ).deadline).toBeUndefined();
	});

	it("says 'já concluída' on a missed due date done later", () => {
		const day = dayView([later], [done(later, "2026-10-22")], D, TZ);
		expect(day.deadline_done).toEqual([
			{ habit_id: later.id, date: "2026-10-22" },
		]);
		expect(dayItems(day).items[0]?.completedOn).toBe("2026-10-22");
	});

	it("is not in Próximos and gets no 'created' notice", () => {
		expect(upcoming([later], today, { ...TZ, days: 30 })).toEqual([]);
		expect(
			newHabitNotice(task(D, { start_date: today }), today, TZ)
		).toBeNull();
	});
});

describe("labels and texts", () => {
	it("says how long is left", () => {
		expect(deadlineLabel("2026-10-22", "2026-10-15")).toEqual({
			text: "Até 22/10 · faltam 7 dias",
			spoken: "até 22 de outubro, faltam 7 dias",
			dueToday: false,
		});
		expect(deadlineLabel("2026-10-15", "2026-10-15").dueToday).toBe(true);
		expect(deadlineDoneLabel("2026-10-22", "2026-10-25")).toEqual({
			text: "Já concluída em 22/10",
			spoken: "já concluída em 22 de outubro",
		});
		expect(deadlineLabel("2026-10-16", "2026-10-15").text).toBe("Vence amanhã");
		expect(deadlineLabel("2026-10-15", "2026-10-15").text).toBe("Vence hoje");
		expect(deadlineLabel("2027-01-05", "2026-12-30")).toEqual({
			text: "Até 05/01/2027 · faltam 6 dias",
			spoken: "até 5 de janeiro de 2027, faltam 6 dias",
			dueToday: false,
		});
	});

	it("summarizes the schedule", () => {
		expect(
			formatSchedule(
				{ type: "deadline", due_date: "2026-11-20" },
				{ today: "2026-10-15" }
			)
		).toBe("Até 20/11");
		expect(
			repeatSummary(
				{
					schedule: { type: "deadline", due_date: "2026-11-20" },
					start_date: "2026-10-15",
				},
				"2026-10-15"
			)
		).toBe("Pode ser concluído até 20/11. Se passar do prazo, fica atrasado.");
	});

	it("knows when a task leaves the main list (Passados)", () => {
		const t = task(D);
		expect(isDeadlineSettled(t, undefined, "2026-10-18")).toBe(false);
		expect(isDeadlineSettled(t, "2026-10-12", "2026-10-18")).toBe(true);
		expect(isDeadlineSettled(t, undefined, "2026-11-04")).toBe(false);
		expect(isDeadlineSettled(t, undefined, "2026-11-05")).toBe(true);
		expect(isDeadlineSettled(A, undefined, "2026-11-05")).toBe(false);
	});
});

describe("validation", () => {
	const today = "2026-10-15";
	const schedule = (due: string) => ({
		type: "deadline" as const,
		due_date: due,
	});

	it("accepts today up to two years ahead, not before today or the start", () => {
		const check = (due: string) =>
			checkHabitDates({ schedule: schedule(due), start_date: today }, today, {
				today,
			});
		expect(check(today)).toBeNull();
		expect(check("2028-10-14")).toBeNull(); // today + 730
		expect(check("2028-10-15")).toBe("due_date_too_far");
		expect(check("2026-10-14")).toBe("date_out_of_range");
		expect(
			checkHabitDates(
				{ schedule: schedule(today), start_date: "2026-10-16" },
				today,
				{ today }
			)
		).toBe("date_before_start");
	});

	it("locks a due date that went by, but keeps it valid unchanged", () => {
		const previous = schedule("2026-10-10");
		const check = (due: string) =>
			checkHabitDates(
				{ schedule: schedule(due), start_date: "2026-10-01" },
				today,
				{
					checkStart: false,
					today,
					previous,
				}
			);
		expect(check("2026-10-10")).toBeNull();
		expect(check("2026-10-30")).toBe("deadline_passed");
		// Before it passes, it can move freely within the limits.
		expect(
			checkHabitDates(
				{ schedule: schedule("2026-10-30"), start_date: "2026-10-01" },
				today,
				{
					checkStart: false,
					today,
					previous: schedule("2026-10-20"),
				}
			)
		).toBeNull();
	});

	it("the form: 'Até uma data', no start, limits and the lock", () => {
		const draft = {
			...emptyDraft(today),
			kind: "deadline" as const,
			due: "2026-11-20",
		};
		expect(buildFromDraft(draft, { today })).toEqual({
			ok: true,
			schedule: { type: "deadline", due_date: "2026-11-20" },
			start_date: today,
		});
		expect(
			buildFromDraft({ ...draft, due: "2026-10-14" }, { today })
		).toMatchObject({
			ok: false,
			errors: { due: "Escolha hoje ou uma data futura." },
		});
		expect(
			buildFromDraft({ ...draft, due: "2029-01-01" }, { today })
		).toMatchObject({
			ok: false,
			errors: { due: "Escolha uma data em até 2 anos." },
		});
		const past = task("2026-10-10");
		const editing = { schedule: past.schedule, start_date: past.start_date };
		const fromHabit = draftFromHabit(past, today)!;
		expect(fromHabit.due).toBe("2026-10-10");
		expect(buildFromDraft(fromHabit, { today, editing }).ok).toBe(true);
		expect(
			buildFromDraft({ ...fromHabit, due: "2026-10-30" }, { today, editing })
		).toMatchObject({
			ok: false,
			errors: { due: DEADLINE_LOCKED },
		});
	});
});

describe("morning digest", () => {
	const today = "2026-10-15";
	const dueToday = task(today, {
		id: "00000000-0000-7000-8000-00000000d003",
		name: "Pagar boleto",
	});
	const dueTomorrow = task("2026-10-16", {
		id: "00000000-0000-7000-8000-00000000d004",
		name: "Consulta",
	});
	const far = task("2026-11-30", {
		id: "00000000-0000-7000-8000-00000000d005",
		name: "Viagem",
	});
	const late = task("2026-10-10", {
		id: "00000000-0000-7000-8000-00000000d006",
		name: "Relatório",
	});

	it("names tasks due today and tomorrow, not far ones; overdue ones stay overdue", () => {
		const content = selectDigestContent(
			[dueToday, dueTomorrow, far, late],
			[],
			today,
			TZ
		);
		expect(content).toMatchObject({
			dueToday: ["Pagar boleto"],
			dueTomorrow: ["Consulta"],
			overdue: ["Relatório"],
			highlights: [],
			todayPending: 1,
		});
		expect(digestMessage(content, true).body).toBe(
			"1 hábito hoje. 1 atrasado: Relatório. Vence hoje: Pagar boleto. Vence amanhã: Consulta."
		);
		expect(digestMessage(content, false).body).toBe(
			"Você tem compromissos hoje, 1 hábito atrasado e um compromisso amanhã."
		);
	});

	it("skips tasks already done", () => {
		const content = selectDigestContent(
			[dueToday, dueTomorrow],
			[done(dueToday, today), done(dueTomorrow, "2026-10-14")],
			today,
			TZ
		);
		expect(content).toMatchObject({
			dueToday: [],
			dueTomorrow: [],
			todayPending: 0,
		});
	});
});

describe("extrasOnlyText", () => {
	const item = (overdueSince: string | null, dueDate: string | null) => ({
		habit: A,
		done: false,
		overdueSince,
		dueDate,
		completedOn: null,
	});
	it("names what the list has besides today's habits", () => {
		expect(extrasOnlyText([item("2026-10-10", null)])).toBe(
			"Nada previsto para hoje além dos atrasados."
		);
		expect(extrasOnlyText([item(null, D)])).toBe(
			"Nada previsto para hoje além das tarefas com prazo."
		);
		expect(extrasOnlyText([item("2026-10-10", null), item(null, D)])).toBe(
			"Nada previsto para hoje além dos atrasados e das tarefas com prazo."
		);
	});
});
