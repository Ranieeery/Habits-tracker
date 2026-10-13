import type { UserSettings } from "@habits/contracts";
import { uuidV7 } from "@habits/core";
import { describe, expect, it } from "vitest";
import { DataError } from "../errors.ts";
import { createLocalRepository } from "./local-repository.ts";
import { createLocalStore } from "./store.ts";
import { openNodeDatabase } from "./testing/node-sql.ts";

const NOW = Date.parse("2026-10-09T15:00:00Z");
const TODAY = "2026-10-09";
const EVERY_DAY = { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] };
const SETTINGS: UserSettings = {
	timezone: "America/Sao_Paulo",
	reminder_time: null,
	morning_digest_enabled: true,
	show_titles_in_notifications: true,
	created_at: 0,
	updated_at: 0,
};

let n = 0;
function setup() {
	const store = createLocalStore(async () => openNodeDatabase());
	let writes = 0;
	let remoteCalls = 0;
	const repository = createLocalRepository({
		store,
		remoteSettings: {
			getSettings: async () => {
				remoteCalls++;
				return SETTINGS;
			},
			updateSettings: async (changes) => ({ ...SETTINGS, ...changes }),
		},
		now: () => NOW,
		newId: () => {
			const bytes = new Uint8Array(16);
			bytes[15] = ++n;
			return uuidV7(NOW, bytes);
		},
		onWrite: () => writes++,
	});
	return { store, repository, counts: () => ({ writes, remoteCalls }) };
}

async function kindOf(promise: Promise<unknown>) {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return error instanceof DataError ? error.kind : "other";
	}
}

describe("local repository", () => {
	it("reads settings from the server once, then from the device", async () => {
		const { repository, counts } = setup();
		await repository.getSettings();
		await repository.getSettings();
		expect(counts().remoteCalls).toBe(1);
		const updated = await repository.updateSettings({ reminder_time: "21:00" });
		expect(await repository.getSettings()).toEqual(updated);
	});

	it("writes go to the outbox and show at once in every view", async () => {
		const { repository, store, counts } = setup();
		const habit = await repository.createHabit({
			name: "  Ler  ",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		expect(habit.name).toBe("Ler");
		await repository.setCompletion(habit.id, TODAY, true);
		await repository.updateHabit(habit.id, { name: "Ler 10 páginas" });

		expect((await repository.listHabits()).map((h) => h.name)).toEqual([
			"Ler 10 páginas",
		]);
		expect((await repository.getDay(TODAY)).completed_habit_ids).toEqual([
			habit.id,
		]);
		expect(await repository.getYearSummary(2026)).toContainEqual({
			date: TODAY,
			possible: 1,
			completed: 1,
		});
		expect((await store.readOutbox()).map((e) => e.mutation.type)).toEqual([
			"habit.create",
			"completion.set",
			"habit.update",
		]);
		expect(counts().writes).toBe(3);
	});

	it("summarizes the year for one habit only (2.7.0 history filter)", async () => {
		const { repository } = setup();
		const read = await repository.createHabit({
			name: "Ler",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		const run = await repository.createHabit({
			name: "Correr",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(read.id, TODAY, true);

		const all = await repository.getYearSummary(2026);
		expect(all).toContainEqual({ date: TODAY, possible: 2, completed: 1 });
		expect(
			await repository.getYearSummary(2026, { habitId: read.id })
		).toContainEqual({ date: TODAY, possible: 1, completed: 1 });
		expect(
			await repository.getYearSummary(2026, { habitId: run.id })
		).toContainEqual({ date: TODAY, possible: 1, completed: 0 });
	});

	it("moves habits with several writes in a row (2.6.0 reorder)", async () => {
		const { repository } = setup();
		const ids: string[] = [];
		for (const name of ["A", "B", "C"]) {
			const habit = await repository.createHabit({
				name,
				schedule: EVERY_DAY,
				start_date: TODAY,
			});
			ids.push(habit.id);
		}
		// Concurrent writes, as several taps would make: none may be lost.
		await Promise.all(
			ids.map((id, index) =>
				repository.updateHabit(id, { sort_key: `a${3 - index}` })
			)
		);
		expect((await repository.listHabits()).map((h) => h.name)).toEqual([
			"C",
			"B",
			"A",
		]);
	});

	it("does not queue a change that changes nothing", async () => {
		const { repository, store } = setup();
		const habit = await repository.createHabit({
			name: "Ler",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(habit.id, TODAY, true);
		await repository.setCompletion(habit.id, TODAY, true);
		await repository.updateHabit(habit.id, { name: "Ler" });
		expect(await store.readOutbox()).toHaveLength(2);
	});

	it("reuses the completion's id when unchecking", async () => {
		const { repository, store } = setup();
		const habit = await repository.createHabit({
			name: "Ler",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(habit.id, TODAY, true);
		await repository.setCompletion(habit.id, TODAY, false);
		const ids = (await store.readOutbox())
			.slice(1)
			.map((e) => (e.mutation as { id: string }).id);
		expect(new Set(ids).size).toBe(1);
	});

	it("reports the same errors as the API would", async () => {
		const { repository } = setup();
		const habit = await repository.createHabit({
			name: "Ler",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		expect(
			await kindOf(repository.setCompletion(habit.id, "2026-09-08", true))
		).toBe("out_of_range");
		expect(
			await kindOf(
				repository.setCompletion(
					"00000000-0000-7000-8000-00000000ffff",
					TODAY,
					true
				)
			)
		).toBe("not_found");
		expect(
			await kindOf(
				repository.createHabit({
					name: "Velho",
					schedule: EVERY_DAY,
					start_date: "2026-09-08",
				})
			)
		).toBe("out_of_range");
		expect(
			await kindOf(
				repository.createHabit({
					name: " ",
					schedule: EVERY_DAY,
					start_date: TODAY,
				})
			)
		).toBe("invalid");
		expect(
			await kindOf(
				repository.updateHabit("00000000-0000-7000-8000-00000000ffff", {
					archived: true,
				})
			)
		).toBe("not_found");
	});
});

describe("habit order (2.4.0)", () => {
	const mirrored = (
		id: string,
		name: string,
		sort_key: string,
		created_at: number
	) => ({
		id,
		name,
		schedule: EVERY_DAY,
		start_date: "2026-10-01",
		archived_at: null,
		sort_key,
		created_at,
		updated_at: created_at,
		deleted_at: null,
	});

	it("lists habits and the day in the server's order, and puts a new one last", async () => {
		const { repository, store } = setup();
		await store.applyPullPage({
			changes: {
				habits: [
					mirrored("00000000-0000-7000-8000-000000000001", "Ler", "a2", 1),
					mirrored("00000000-0000-7000-8000-000000000002", "Correr", "a0", 2),
					mirrored("00000000-0000-7000-8000-000000000003", "Meditar", "a1", 3),
				],
				completions: [],
			},
			cursor: "1.3",
			has_more: false,
		});
		expect((await repository.listHabits()).map((h) => h.name)).toEqual([
			"Correr",
			"Meditar",
			"Ler",
		]);

		const created = await repository.createHabit({
			name: "Alongar",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		expect(created.sort_key).toBe("a3");
		const [entry] = await store.readOutbox();
		expect(entry?.mutation).toMatchObject({
			type: "habit.create",
			sort_key: "a3",
		});
		expect(
			(await repository.getDay(TODAY)).possible_habits.map((h) => h.name)
		).toEqual(["Correr", "Meditar", "Ler", "Alongar"]);
	});

	it("moves a habit through the outbox", async () => {
		const { repository, store } = setup();
		await store.applyPullPage({
			changes: {
				habits: [
					mirrored("00000000-0000-7000-8000-000000000001", "Ler", "a0", 1),
					mirrored("00000000-0000-7000-8000-000000000002", "Correr", "a1", 2),
				],
				completions: [],
			},
			cursor: "1.2",
			has_more: false,
		});
		await repository.updateHabit("00000000-0000-7000-8000-000000000002", {
			sort_key: "Zz",
		});
		expect((await repository.listHabits()).map((h) => h.name)).toEqual([
			"Correr",
			"Ler",
		]);
	});
});

describe("overdue habits on today (2.8.0)", () => {
	const CONDO = "00000000-0000-7000-8000-000000000010";
	const READ = "00000000-0000-7000-8000-000000000011";
	const pulled = (id: string, name: string, schedule: unknown) => ({
		id,
		name,
		schedule,
		start_date: "2026-09-01",
		archived_at: null,
		sort_key: id === CONDO ? "a1" : "a0",
		created_at: Date.parse("2026-09-01T12:00:00Z"),
		updated_at: 1,
		deleted_at: null,
	});

	async function seeded() {
		const ctx = setup();
		await ctx.store.applyPullPage({
			changes: {
				habits: [
					pulled(READ, "Ler", EVERY_DAY),
					pulled(CONDO, "Pagar condomínio", {
						type: "monthly_days",
						days: [5],
					}),
				] as never,
				completions: [],
			},
			cursor: "1.2",
			has_more: false,
		});
		return ctx;
	}

	it("lists them on today only, from the local data", async () => {
		const { repository } = await seeded();
		const today = await repository.getDay(TODAY);
		expect(today.possible_habits.map((h) => h.name)).toEqual(["Ler"]);
		expect(today.overdue).toEqual([
			expect.objectContaining({
				habit: expect.objectContaining({ id: CONDO }),
				since: "2026-10-05",
				completed_today: false,
			}),
		]);
		expect(await repository.getDay("2026-10-08")).not.toHaveProperty("overdue");
	});

	it("marks them with today's date through the outbox (offline) and undoes it", async () => {
		const { repository, store } = await seeded();
		await repository.setCompletion(CONDO, TODAY, true);
		const marked = await repository.getDay(TODAY);
		expect(marked.overdue?.[0]?.completed_today).toBe(true);
		expect(marked.completed_habit_ids).toContain(CONDO);
		const [entry] = await store.readOutbox();
		expect(entry?.mutation).toMatchObject({
			type: "completion.set",
			habit_id: CONDO,
			date: TODAY,
			completed: true,
		});
		// The missed day keeps its failure; today counts it as done.
		const summary = await repository.getYearSummary(2026);
		expect(summary).toContainEqual({
			date: "2026-10-05",
			possible: 2,
			completed: 0,
		});
		expect(summary).toContainEqual({
			date: TODAY,
			possible: 2,
			completed: 1,
		});

		await repository.setCompletion(CONDO, TODAY, false);
		const undone = await repository.getDay(TODAY);
		expect(undone.overdue?.[0]?.completed_today).toBe(false);
		expect(undone.completed_habit_ids).toEqual([]);
	});

	it("drops a habit completed on a past day inside the window", async () => {
		const { repository } = await seeded();
		await repository.setCompletion(CONDO, "2026-10-07", true);
		expect((await repository.getDay(TODAY)).overdue).toEqual([]);
	});
});
