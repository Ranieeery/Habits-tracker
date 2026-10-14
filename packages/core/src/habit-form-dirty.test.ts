import type { Schedule } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { draftFromHabit, emptyDraft, type HabitDraft } from "./habit-draft.ts";
import {
	DISCARD_CHANGES,
	type HabitFormState,
	isHabitFormDirty,
	normalizeHabitForm,
	resolveCloseRequest,
} from "./habit-form-dirty.ts";

const TODAY = "2026-10-14";

const created = (): HabitFormState => ({
	name: "",
	description: "",
	draft: emptyDraft(TODAY),
});

const withDraft = (
	state: HabitFormState,
	changes: Partial<HabitDraft>
): HabitFormState => ({
	...state,
	draft: state.draft ? { ...state.draft, ...changes } : null,
});

const dirty = (initial: HabitFormState, current: HabitFormState) =>
	isHabitFormDirty(normalizeHabitForm(initial), current);

const editing = (
	schedule: Schedule,
	extra: Partial<HabitFormState> = {}
): HabitFormState => ({
	name: "Ler",
	description: "Um capítulo",
	draft: draftFromHabit({ schedule, start_date: "2026-09-01" }, TODAY),
	...extra,
});

describe("isHabitFormDirty: creating", () => {
	it("is clean with the defaults untouched", () => {
		expect(dirty(created(), created())).toBe(false);
	});

	it("is dirty with a name typed", () => {
		expect(dirty(created(), { ...created(), name: "Ler" })).toBe(true);
	});

	it("ignores spaces only, and spaces around the name", () => {
		expect(dirty(created(), { ...created(), name: "   " })).toBe(false);
		const named = { ...created(), name: "Ler" };
		expect(dirty(named, { ...named, name: "  Ler \t" })).toBe(false);
	});

	it("is clean again after erasing what was typed", () => {
		const typed = { ...created(), name: "Ler" };
		expect(dirty(created(), typed)).toBe(true);
		expect(dirty(created(), { ...typed, name: "" })).toBe(false);
	});

	it("is dirty when only one weekday changes, clean once it is back", () => {
		const off = withDraft(created(), { weekdays: [0, 1, 2, 3, 4, 5] });
		expect(dirty(created(), off)).toBe(true);
		const back = withDraft(created(), { weekdays: [6, 0, 1, 2, 3, 4, 5] });
		expect(dirty(created(), back)).toBe(false);
	});

	it("reads weekdays and month days out of order or repeated as the same", () => {
		const base = withDraft(created(), {
			kind: "monthly_days",
			monthDays: [5, 20],
		});
		expect(dirty(base, withDraft(base, { monthDays: [20, 5, 5] }))).toBe(false);
		expect(dirty(base, withDraft(base, { monthDays: [5, 21] }))).toBe(true);
		const week = withDraft(created(), { weekdays: [1, 3] });
		expect(dirty(week, withDraft(week, { weekdays: [3, 1, 1] }))).toBe(false);
	});

	it("is clean after switching the repetition and back, whatever changed meanwhile", () => {
		const switched = withDraft(created(), { kind: "interval", every: "5" });
		expect(dirty(created(), switched)).toBe(true);
		expect(dirty(created(), withDraft(switched, { kind: "weekdays" }))).toBe(
			false
		);
	});

	it("compares the start date and the dates of each kind", () => {
		expect(
			dirty(created(), withDraft(created(), { start: "2026-10-15" }))
		).toBe(true);
		const once = withDraft(created(), { kind: "once", date: "2026-10-20" });
		expect(dirty(once, withDraft(once, { date: "2026-10-21" }))).toBe(true);
		// "Começa em" is not used by a single date.
		expect(dirty(once, withDraft(once, { start: "2026-12-01" }))).toBe(false);
		const task = withDraft(created(), { kind: "deadline", due: "2026-11-01" });
		expect(dirty(task, withDraft(task, { due: "2026-11-02" }))).toBe(true);
		expect(dirty(task, withDraft(task, { due: "" }))).toBe(true);
		const yearly = withDraft(created(), { kind: "yearly", month: 2, day: 29 });
		expect(dirty(yearly, withDraft(yearly, { day: 28 }))).toBe(true);
		expect(dirty(yearly, withDraft(yearly, { month: 3 }))).toBe(true);
	});

	it("treats an empty date like a missing one", () => {
		const empty = withDraft(created(), { kind: "once", date: "" });
		const missing = {
			...empty,
			draft: { ...empty.draft, date: undefined },
		} as unknown as HabitFormState; // A form that never set the field.
		expect(dirty(empty, missing)).toBe(false);
	});

	it("reads the interval as a number when it is one", () => {
		const base = withDraft(created(), { kind: "interval", every: "2" });
		expect(dirty(base, withDraft(base, { every: " 02 " }))).toBe(false);
		expect(dirty(base, withDraft(base, { every: "3" }))).toBe(true);
		expect(dirty(base, withDraft(base, { every: "" }))).toBe(true);
	});
});

describe("isHabitFormDirty: description", () => {
	it("treats null, undefined and empty as the same", () => {
		const base = { ...created(), description: null };
		expect(dirty(base, { ...created(), description: "" })).toBe(false);
		expect(dirty(base, { ...created(), description: undefined })).toBe(false);
		expect(dirty(base, { ...created(), description: " \n " })).toBe(false);
	});

	it("ignores line breaks and spaces at the ends", () => {
		const base = editing({ type: "weekdays", days: [1] });
		expect(dirty(base, { ...base, description: "\r\n  Um capítulo\n\n" })).toBe(
			false
		);
		expect(dirty(base, { ...base, description: "Um capítulo\nou dois" })).toBe(
			true
		);
	});

	it("keeps line breaks inside the text", () => {
		const base = { ...created(), description: "a\nb" };
		expect(dirty(base, { ...base, description: "a\r\nb" })).toBe(false);
		expect(dirty(base, { ...base, description: "a b" })).toBe(true);
	});
});

describe("isHabitFormDirty: editing", () => {
	const schedules: Schedule[] = [
		{ type: "weekdays", days: [1, 3, 5] },
		{ type: "interval", every: 3, anchor_date: "2026-09-01" },
		{ type: "monthly_days", days: [10, 31] },
		{ type: "once", date: "2026-11-20" },
		{ type: "yearly", month: 2, day: 29 },
		{ type: "deadline", due_date: "2026-12-01" },
	];

	it.each(schedules)("is clean without changes ($type)", (schedule) => {
		expect(dirty(editing(schedule), editing(schedule))).toBe(false);
	});

	it("is dirty when the name changes and clean when it is back", () => {
		const base = editing({ type: "weekdays", days: [1] });
		expect(dirty(base, { ...base, name: "Ler mais" })).toBe(true);
		expect(dirty(base, { ...base, name: " Ler " })).toBe(false);
	});

	it("is dirty when the repetition changes and clean when it is back", () => {
		const base = editing({ type: "monthly_days", days: [10] });
		const changed = withDraft(base, { kind: "weekdays" });
		expect(dirty(base, changed)).toBe(true);
		expect(dirty(base, withDraft(changed, { kind: "monthly_days" }))).toBe(
			false
		);
	});

	it("compares name and description only for a schedule it cannot edit", () => {
		const base = { name: "Ler", description: "", draft: null };
		expect(dirty(base, { ...base })).toBe(false);
		expect(dirty(base, { ...base, name: "Ler mais" })).toBe(true);
		expect(dirty(base, { ...base, draft: emptyDraft(TODAY) })).toBe(true);
	});
});

describe("resolveCloseRequest", () => {
	it("closes at once without changes", () => {
		expect(resolveCloseRequest({ dirty: false, asking: false })).toBe("close");
	});

	it("asks with changes", () => {
		expect(resolveCloseRequest({ dirty: true, asking: false })).toBe("ask");
	});

	it("keeps editing when the question is already open", () => {
		expect(resolveCloseRequest({ dirty: true, asking: true })).toBe("keep");
		expect(resolveCloseRequest({ dirty: false, asking: true })).toBe("keep");
	});
});

it("has the question's pt-BR texts", () => {
	expect(DISCARD_CHANGES).toEqual({
		title: "Descartar alterações?",
		body: "Você tem alterações que não foram salvas.",
		keep: "Continuar editando",
		discard: "Descartar",
	});
});
