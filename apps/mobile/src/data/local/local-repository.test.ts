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
			await kindOf(repository.setCompletion(habit.id, "2026-10-01", true))
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
					start_date: "2026-10-01",
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
