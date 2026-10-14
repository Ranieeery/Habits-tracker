import type { Mutation } from "@habits/contracts";
import { completionKey, uuidV7 } from "@habits/core";
import { describe, expect, it } from "vitest";
import { createLocalRepository } from "../local/local-repository.ts";
import { createLocalStore, type LocalStore } from "../local/store.ts";
import {
	createFakeServer,
	type FakeServer,
	serverCompletion,
} from "../local/testing/fake-server.ts";
import { openNodeDatabase } from "../local/testing/node-sql.ts";
import {
	BACKOFF_BASE_MS,
	backoffDelay,
	createSyncEngine,
	DEPENDENCY_FAILED_CODE,
	PULL_PAGE_SIZE,
	type Timers,
} from "./engine.ts";
import { TransportError } from "./transport.ts";

const NOW = Date.parse("2026-10-09T15:00:00Z"); // 12:00 in São Paulo
const TODAY = "2026-10-09";
const DAY_MS = 24 * 60 * 60_000;
const EVERY_DAY = { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] };

function fakeTimers() {
	const pending: { callback: () => void; ms: number }[] = [];
	const timers: Timers = {
		setTimeout: (callback, ms) => {
			const timer = { callback, ms };
			pending.push(timer);
			return timer;
		},
		clearTimeout: (handle) => {
			const index = pending.indexOf(handle as (typeof pending)[number]);
			if (index >= 0) pending.splice(index, 1);
		},
	};
	return { timers, pending };
}

let counter = 0;
const randomBytes = () => {
	const bytes = new Uint8Array(16);
	new DataView(bytes.buffer).setUint32(12, ++counter);
	return bytes;
};

async function setup(
	options: { server?: FakeServer; store?: LocalStore } = {}
) {
	let now = NOW;
	const server = options.server ?? createFakeServer(NOW);
	const store =
		options.store ?? createLocalStore(async () => openNodeDatabase());
	const { timers, pending } = fakeTimers();
	const events = { unauthorized: 0, changed: 0 };
	const newId = () => uuidV7(now, randomBytes());
	const engine = createSyncEngine({
		store,
		transport: server,
		now: () => now,
		random: () => 0.5,
		timers,
		owner: "this-device",
		onUnauthorized: () => events.unauthorized++,
		onDataChanged: () => events.changed++,
	});
	const repository = createLocalRepository({
		store,
		remoteSettings: {
			getSettings: async () => server.settings,
			updateSettings: async () => server.settings,
		},
		now: () => now,
		newId,
		onWrite: () => engine.notifyLocalWrite(),
	});
	await store.ensureUser("user-1");
	engine.start();
	return {
		server,
		store,
		engine,
		repository,
		events,
		pending,
		newId,
		setNow: (ms: number) => {
			now = ms;
			server.setNow(ms);
		},
	};
}

/** A habit created on the server by another device. */
function serverHabit(server: FakeServer, name = "Ler"): string {
	const id = uuidV7(NOW, randomBytes());
	server.write({
		mutation_id: uuidV7(NOW, randomBytes()),
		created_at: NOW,
		type: "habit.create",
		id,
		name,
		schedule: EVERY_DAY,
		start_date: "2026-10-02",
	});
	return id;
}

describe("sync engine", () => {
	it("first sync pulls everything, then works offline-first", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });

		expect(engine.getStatus().initialSyncDone).toBe(false);
		expect(await engine.sync("launch")).toBe("synced");
		expect(engine.getStatus()).toMatchObject({
			state: "idle",
			initialSyncDone: true,
			pending: 0,
		});
		expect((await repository.listHabits()).map((h) => h.id)).toEqual([habitId]);
		expect(await store.getSettings()).toEqual(server.settings);
	});

	it("marks offline, keeps the change pending, and sends it when back", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository } = await setup({ server });
		await engine.sync("launch");

		engine.setOnline(false);
		await repository.setCompletion(habitId, TODAY, true);
		expect((await repository.getDay(TODAY)).completed_habit_ids).toEqual([
			habitId,
		]);
		expect(await engine.sync("write")).toBe("offline");
		expect(engine.getStatus()).toMatchObject({ state: "offline", pending: 1 });
		expect(serverCompletion(server, habitId, TODAY)).toBeUndefined();

		engine.setOnline(true); // network regained: syncs at once
		await new Promise((resolve) => setTimeout(resolve, 0));
		await engine.sync("manual");
		expect(serverCompletion(server, habitId, TODAY)?.deleted_at).toBeNull();
		expect(engine.getStatus()).toMatchObject({ state: "idle", pending: 0 });
		expect((await repository.getDay(TODAY)).completed_habit_ids).toEqual([
			habitId,
		]);
	});

	it("unchecking offline and checking again sends both in order", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository } = await setup({ server });
		await engine.sync("launch");
		await repository.setCompletion(habitId, TODAY, true);
		await repository.setCompletion(habitId, TODAY, false);
		await repository.setCompletion(habitId, TODAY, true);
		await engine.sync("manual");
		expect(server.calls.push.at(-1)?.map((m) => m.type)).toHaveLength(3);
		expect(serverCompletion(server, habitId, TODAY)?.deleted_at).toBeNull();
	});

	it("retries transient errors with exponential backoff and jitter", async () => {
		const { engine, server, pending } = await setup();
		server.failNext("pull", {
			kind: "transient",
			status: 503,
			retryAfterMs: null,
		});
		expect(await engine.sync("launch")).toBe("failed");
		expect(engine.getStatus()).toMatchObject({
			state: "error",
			error: "server",
		});
		// random() = 0.5: half of the first window.
		expect(pending.at(-1)?.ms).toBe(backoffDelay(0, 0.5));
		expect(backoffDelay(0, 0.5)).toBe(BACKOFF_BASE_MS / 2);
		// Writes and the interval wait for the backoff; the user does not.
		expect(await engine.sync("write")).toBe("skipped");

		server.failNext("pull", {
			kind: "transient",
			status: 503,
			retryAfterMs: null,
		});
		expect(await engine.sync("manual")).toBe("failed");
		expect(pending.at(-1)?.ms).toBe(backoffDelay(1, 0.5));
		expect(pending).toHaveLength(1); // one retry timer at a time

		pending.at(-1)!.callback(); // the retry fires
		await new Promise((resolve) => setTimeout(resolve, 0));
		await engine.sync("manual");
		expect(engine.getStatus()).toMatchObject({
			state: "idle",
			nextRetryAt: null,
		});
	});

	it("waits at least what Retry-After asks", async () => {
		const { engine, server, pending } = await setup();
		server.failNext("pull", {
			kind: "transient",
			status: 429,
			retryAfterMs: 120_000,
		});
		await engine.sync("launch");
		expect(pending.at(-1)?.ms).toBe(120_000);
	});

	it("runs one sync at a time and queues one more for calls in between", async () => {
		const { engine, server } = await setup();
		const [a, b, c] = await Promise.all([
			engine.sync("launch"),
			engine.sync("foreground"),
			engine.sync("manual"),
		]);
		expect([a, b, c]).toEqual(["synced", "synced", "synced"]);
		// The first run, plus one re-run for the calls made while it ran.
		expect(server.calls.pull).toHaveLength(2);
	});

	it("does not run while another context holds the database lease", async () => {
		const { engine, store } = await setup();
		await store.acquireLease("background-task", NOW, 60_000);
		expect(await engine.sync("manual")).toBe("busy");
		await store.releaseLease("background-task");
		expect(await engine.sync("manual")).toBe("synced");
	});

	it("resumes an interrupted pull from the last page written", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		for (let day = 1; day <= 5; day++) {
			server.write({
				mutation_id: uuidV7(NOW, randomBytes()),
				created_at: NOW,
				type: "completion.set",
				id: uuidV7(NOW, randomBytes()),
				habit_id: habitId,
				date: `2026-10-0${day + 3}`,
				completed: true,
			});
		}
		const { engine, store } = await setup({ server });
		// Small pages: fail after the first one.
		const pull = server.pull.bind(server);
		let calls = 0;
		server.pull = async (cursor) => {
			calls += 1;
			if (calls === 2) throw new TransportError({ kind: "offline" });
			return pull(cursor, 2);
		};
		expect(await engine.sync("launch")).toBe("offline");
		const cursor = await store.getMeta("cursor");
		expect(cursor).toBe("1.2");

		await engine.sync("manual");
		// The failed request never reached the server; the retry resumed at 1.2.
		expect(calls).toBe(4);
		expect(server.calls.pull).toEqual([null, "1.2", "1.4"]);
		const { completions } = await store.readMirror();
		expect(completions).toHaveLength(5);
		expect(PULL_PAGE_SIZE).toBeGreaterThan(2);
	});

	it("resends a push whose response was lost without duplicating it", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");
		await repository.setCompletion(habitId, TODAY, true);
		server.dropNextPushResponse();
		expect(await engine.sync("manual")).toBe("offline");
		expect(engine.getStatus().pending).toBe(1);

		await engine.sync("manual");
		const sent = server.calls.push.flat().map((m) => m.mutation_id);
		expect(sent).toHaveLength(2);
		expect(new Set(sent).size).toBe(1); // same mutation_id, answered duplicate
		expect(await store.readOutbox()).toEqual([]);
		expect(server.state.completions.size).toBe(1);
	});

	it("reconciles a local completion id with the server's canonical id", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");
		// Offline on this device; another device marks the same day first.
		engine.setOnline(false);
		await repository.setCompletion(habitId, TODAY, true);
		await repository.setCompletion(habitId, TODAY, false);
		const local = (await store.readOutbox()).map((e) => e.mutation);
		const localId = (local[0] as Extract<Mutation, { type: "completion.set" }>)
			.id;
		const other = server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "completion.set",
			id: uuidV7(NOW, randomBytes()),
			habit_id: habitId,
			date: TODAY,
			completed: true,
		});
		expect(other.canonical_id).not.toBe(localId);

		engine.setOnline(true);
		await engine.sync("manual");
		const { completions } = await store.readMirror();
		expect(completions.map((c) => c.id)).toEqual([other.canonical_id]);
		expect(completions[0]?.deleted_at).not.toBeNull(); // our uncheck came last
		expect(await store.readOutbox()).toEqual([]);
	});

	it("moves a permanent rejection to the failures without blocking the rest", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store, setNow } = await setup({ server });
		await engine.sync("launch");
		// Marked "today" offline, synced 31 days later: out of the window.
		engine.setOnline(false);
		await repository.setCompletion(habitId, TODAY, true);
		setNow(NOW + 31 * DAY_MS);
		await repository.setCompletion(habitId, "2026-11-09", true);
		engine.setOnline(true);
		await engine.sync("manual");

		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 1 });
		const [failed] = (await store.readOutbox()).filter(
			(e) => e.state === "failed"
		);
		expect(failed?.lastError?.code).toBe("date_out_of_range");
		expect(serverCompletion(server, habitId, "2026-11-09")).toBeDefined();
		// The rejected change no longer shows; the data is kept until discarded.
		expect((await repository.getDay(TODAY)).completed_habit_ids).toEqual([]);

		await engine.discard([failed!.mutation.mutation_id]);
		expect(engine.getStatus().failed).toBe(0);
	});

	it("syncs a past day edited up to 30 days back, refuses older ones, loses nothing", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store, setNow } = await setup({ server });
		await engine.sync("launch");
		engine.setOnline(false);
		// Past days edited offline today: 30 days back (the limit) and 25.
		await repository.setCompletion(habitId, "2026-09-09", true);
		await repository.setCompletion(habitId, "2026-09-14", true);
		// Older than the window: refused before it reaches the outbox.
		await expect(
			repository.setCompletion(habitId, "2026-09-08", true)
		).rejects.toMatchObject({ kind: "out_of_range" });
		// The phone stays offline 5 more days: 09/09 is now 35 days back.
		setNow(NOW + 5 * DAY_MS);
		engine.setOnline(true);
		await engine.sync("manual");

		expect(serverCompletion(server, habitId, "2026-09-14")).toBeDefined();
		expect(serverCompletion(server, habitId, "2026-09-09")).toBeUndefined();
		const outbox = await store.readOutbox();
		const failed = outbox.filter((e) => e.state === "failed");
		expect(failed.map((e) => [e.mutation.type, e.lastError?.code])).toEqual([
			["completion.set", "date_out_of_range"],
		]);
		// Kept for "Tentar de novo"/"Descartar", no longer shown on the day.
		expect(failed[0]?.mutation).toMatchObject({ date: "2026-09-09" });
		expect((await repository.getDay("2026-09-09")).completed_habit_ids).toEqual(
			[]
		);
		expect((await repository.getDay("2026-09-14")).completed_habit_ids).toEqual(
			[habitId]
		);
		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 1 });
	});

	it("ties the changes of a habit whose creation failed to that failure", async () => {
		const { engine, repository, store, server, setNow } = await setup();
		await engine.sync("launch");
		engine.setOnline(false);
		const habit = await repository.createHabit({
			name: "Correr",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(habit.id, TODAY, true);
		// Synced 31 days later: start_date is now too old for the server.
		setNow(NOW + 31 * DAY_MS);
		engine.setOnline(true);
		await engine.sync("manual");

		const outbox = await store.readOutbox();
		expect(outbox.map((e) => [e.mutation.type, e.lastError?.code])).toEqual([
			["habit.create", "date_out_of_range"],
			["completion.set", DEPENDENCY_FAILED_CODE],
		]);
		// The failures list groups them: one retry or discard for both.
		const create = outbox[0]!.mutation.mutation_id;
		expect(outbox[1]?.lastError?.details).toEqual({ mutation_id: create });
		expect(server.calls.push).toHaveLength(1);
	});

	it("does not send changes of a habit whose creation already failed", async () => {
		const { engine, repository, store, server } = await setup();
		await engine.sync("launch");
		engine.setOnline(false);
		const habit = await repository.createHabit({
			name: "Correr",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(habit.id, TODAY, true);
		const [create] = await store.readOutbox();
		await store.failEntries([
			{
				mutationId: create!.mutation.mutation_id,
				error: { code: "conflict", message: "Habit id already in use" },
			},
		]);
		engine.setOnline(true);
		await engine.sync("manual");
		const outbox = await store.readOutbox();
		expect(outbox.map((e) => e.lastError?.code)).toEqual([
			"conflict",
			DEPENDENCY_FAILED_CODE,
		]);
		expect(server.calls.push).toEqual([]);
	});

	it("isolates a mutation when the whole batch is refused", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository } = await setup({ server });
		await engine.sync("launch");
		await repository.setCompletion(habitId, TODAY, true);
		await repository.setCompletion(habitId, "2026-10-08", true);
		const refused = {
			kind: "rejected" as const,
			status: 413,
			error: { code: "validation_error", message: "Too large" },
		};
		server.failNext("push", refused); // the batch of 2
		server.failNext("push", refused); // the first alone
		await engine.sync("manual");
		expect(server.calls.push.map((batch) => batch.length)).toEqual([2, 1, 1]);
		expect(engine.getStatus()).toMatchObject({ failed: 1, pending: 0 });
		expect(serverCompletion(server, habitId, "2026-10-08")).toBeDefined();
	});

	it("starts over when the server asks for a reset, keeping pending changes", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");
		engine.setOnline(false);
		await repository.setCompletion(habitId, TODAY, true);
		engine.setOnline(true);
		server.resetNextPull();
		await engine.sync("manual");
		expect(server.calls.pull.slice(-2)).toEqual(["1.1", null]);
		const { completions } = await store.readMirror();
		expect(completions.map((c) => c.habit_id)).toEqual([habitId]);
	});

	it("signs out on 401 and keeps the outbox", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, events } = await setup({ server });
		await engine.sync("launch");
		await repository.setCompletion(habitId, TODAY, true);
		server.failNext("push", { kind: "unauthorized" });
		expect(await engine.sync("manual")).toBe("failed");
		expect(events.unauthorized).toBe(1);
		expect(engine.getStatus()).toMatchObject({
			error: "unauthorized",
			pending: 1,
		});
	});

	it("never mixes users: another user signing in wipes the device", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");
		await repository.setCompletion(habitId, TODAY, true);
		expect(await store.ensureUser("user-1")).toBe(false);
		expect(await store.ensureUser("user-2")).toBe(true);
		expect(await store.readOutbox()).toEqual([]);
		expect((await store.readMirror()).habits).toEqual([]);
		expect(await store.getMeta("initial_sync_done")).toBeNull();
	});

	it("shows a habit created offline at once and its completion with it", async () => {
		const { engine, repository, server } = await setup();
		await engine.sync("launch");
		engine.setOnline(false);
		const habit = await repository.createHabit({
			name: "Meditar",
			schedule: EVERY_DAY,
			start_date: TODAY,
		});
		await repository.setCompletion(habit.id, TODAY, true);
		const day = await repository.getDay(TODAY);
		expect(day.completed_habit_ids).toEqual([habit.id]);

		engine.setOnline(true);
		await engine.sync("manual");
		expect(server.state.habits.get(habit.id)?.name).toBe("Meditar");
		expect(
			server.state.completions.get(completionKey(habit.id, TODAY))
		).toBeDefined();
	});

	it("reports the device clock offset from the server", async () => {
		const { engine, server } = await setup();
		server.skewMs = 3 * 60 * 60_000;
		await engine.sync("launch");
		expect(engine.getStatus().clockSkewMs).toBe(3 * 60 * 60_000);
	});
});

describe("deleting habits (2.11.0)", () => {
	async function archivedOnServer(server: FakeServer, name = "Ler") {
		const habitId = serverHabit(server, name);
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "habit.update",
			habit_id: habitId,
			changes: { archived: true },
		});
		return habitId;
	}

	it("deletes offline at once, everywhere, and syncs the tombstone", async () => {
		const server = createFakeServer(NOW);
		const live = serverHabit(server, "Correr");
		const habitId = await archivedOnServer(server);
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "completion.set",
			id: uuidV7(NOW, randomBytes()),
			habit_id: habitId,
			date: "2026-10-05",
			completed: true,
		});
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");
		const before = await repository.getYearSummary(2026);

		engine.setOnline(false);
		await repository.deleteHabit(habitId);

		expect((await repository.listHabits()).map((h) => h.id)).toEqual([live]);
		const oct5 = await repository.getDay("2026-10-05");
		expect(oct5.possible_habits.map((h) => h.id)).toEqual([live]);
		expect(oct5.completed_habit_ids).toEqual([]);
		expect(await repository.getYearSummary(2026)).not.toEqual(before);
		expect((await store.readOutbox()).map((e) => e.mutation.type)).toEqual([
			"habit.delete",
		]);

		engine.setOnline(true);
		await engine.sync("manual");
		expect(server.state.habits.get(habitId)?.deleted_at).toBe(NOW);
		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 0 });
		expect((await repository.listHabits()).map((h) => h.id)).toEqual([live]);
	});

	it("delete then Desfazer before syncing leaves the server as it was", async () => {
		const server = createFakeServer(NOW);
		const habitId = await archivedOnServer(server);
		const { engine, repository } = await setup({ server });
		await engine.sync("launch");
		const before = await repository.getYearSummary(2026);
		const original = server.state.habits.get(habitId);

		engine.setOnline(false);
		await repository.deleteHabit(habitId);
		await repository.restoreHabit(habitId);
		expect((await repository.listHabits()).map((h) => h.id)).toEqual([habitId]);

		engine.setOnline(true);
		await engine.sync("manual");
		expect(server.state.habits.get(habitId)).toMatchObject({
			...original,
			deleted_at: null,
			updated_at: NOW,
		});
		expect(await repository.getYearSummary(2026)).toEqual(before);
	});

	it("refuses to delete a habit that is not archived, writing nothing", async () => {
		const server = createFakeServer(NOW);
		const habitId = serverHabit(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");

		await expect(repository.deleteHabit(habitId)).rejects.toMatchObject({
			kind: "conflict",
		});
		await expect(
			repository.deleteHabit(uuidV7(NOW, randomBytes()))
		).rejects.toMatchObject({
			kind: "not_found",
		});
		expect(await store.readOutbox()).toEqual([]);
	});

	it("brings the habit back when the server refuses the delete (unarchived elsewhere)", async () => {
		const server = createFakeServer(NOW);
		const habitId = await archivedOnServer(server);
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");

		engine.setOnline(false);
		await repository.deleteHabit(habitId);
		// Meanwhile, the web unarchives it.
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "habit.update",
			habit_id: habitId,
			changes: { archived: false },
		});
		engine.setOnline(true);
		await engine.sync("manual");

		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 1 });
		const [failed] = await store.readOutbox();
		expect(failed?.lastError?.code).toBe("conflict");
		expect((await repository.listHabits()).map((h) => h.id)).toEqual([habitId]);
	});

	it("goes to the failures, without blocking the rest, against an API that does not know it", async () => {
		const server = createFakeServer(NOW);
		const habitId = await archivedOnServer(server);
		const live = serverHabit(server, "Correr");
		// An API older than 2.11.0 rejects an unknown mutation type alone.
		const push = server.push.bind(server);
		server.push = async (mutations) => {
			const known = mutations.filter((m) => m.type !== "habit.delete");
			const applied = await push(known);
			return mutations.map(
				(m) =>
					applied.find((r) => r.mutation_id === m.mutation_id) ?? {
						mutation_id: m.mutation_id,
						status: "rejected" as const,
						error: { code: "validation_error", message: "Invalid mutation" },
					}
			);
		};
		const { engine, repository, store } = await setup({ server });
		await engine.sync("launch");

		await repository.deleteHabit(habitId);
		await repository.setCompletion(live, TODAY, true);
		await engine.sync("manual");

		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 1 });
		expect(serverCompletion(server, live, TODAY)?.deleted_at).toBeNull();
		const failed = (await store.readOutbox()).filter(
			(e) => e.state === "failed"
		);
		expect(failed.map((e) => e.mutation.type)).toEqual(["habit.delete"]);
		expect((await repository.listHabits()).map((h) => h.id)).toContain(habitId);
	});

	it("hides a habit deleted on another device after a pull", async () => {
		const server = createFakeServer(NOW);
		const habitId = await archivedOnServer(server);
		const { engine, repository } = await setup({ server });
		await engine.sync("launch");
		expect(await repository.listHabits()).toHaveLength(1);

		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "habit.delete",
			habit_id: habitId,
		});
		await engine.sync("manual");

		expect(await repository.listHabits()).toEqual([]);
	});
});

describe("postponing an occurrence (2.16.0)", () => {
	/** "Pagar conta", on day 9 of every month, created by another device. */
	function monthlyOnServer(server: FakeServer): string {
		const id = uuidV7(NOW, randomBytes());
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "habit.create",
			id,
			name: "Pagar conta",
			schedule: { type: "monthly_days", days: [9] },
			start_date: "2026-10-01",
		});
		return id;
	}
	const request = (id: string, to: string, sequence = 1, from = TODAY) => ({
		id,
		original_date: TODAY,
		from_date: from,
		to_date: to,
		sequence,
	});

	it("postpones offline at once, and syncs the next day judged by the day it was made", async () => {
		const server = createFakeServer(NOW);
		const habitId = monthlyOnServer(server);
		const { engine, repository, store, newId, setNow } = await setup({
			server,
		});
		await engine.sync("launch");

		engine.setOnline(false);
		await repository.rescheduleHabit(habitId, request(newId(), "2026-10-16"));
		expect((await repository.getDay(TODAY)).possible_habits).toEqual([]);
		const moved = await repository.getDay("2026-10-16");
		expect(moved.possible_habits.map((h) => h.id)).toEqual([habitId]);
		expect(moved.moved_in).toEqual([
			{ habit_id: habitId, original_date: TODAY, count: 1 },
		]);
		const [entry] = await store.readOutbox();
		expect(entry?.mutation).toMatchObject({
			type: "reschedule.create",
			action_date: TODAY,
		});

		// Back online on the next day: E (today) already went by, but the
		// rule runs with the action's date.
		setNow(NOW + DAY_MS);
		engine.setOnline(true);
		await engine.sync("manual");
		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 0 });
		expect([...server.state.reschedules.values()]).toEqual([
			expect.objectContaining({ habit_id: habitId, to_date: "2026-10-16" }),
		]);
		expect((await repository.getReschedules()).reschedules).toHaveLength(1);
	});

	it("checks the limit locally, with core's reason", async () => {
		const server = createFakeServer(NOW);
		const habitId = monthlyOnServer(server);
		const { engine, repository, newId } = await setup({ server });
		await engine.sync("launch");
		await repository.rescheduleHabit(habitId, request(newId(), "2026-10-10"));
		await repository.rescheduleHabit(
			habitId,
			request(newId(), "2026-10-11", 2, "2026-10-10")
		);
		await expect(
			repository.rescheduleHabit(
				habitId,
				request(newId(), "2026-10-12", 3, "2026-10-11")
			)
		).rejects.toMatchObject({
			kind: "conflict",
			message: "Limite de 2 adiamentos atingido",
		});
		await expect(
			repository.rescheduleHabit(habitId, request(newId(), "2026-11-09"))
		).rejects.toMatchObject({ kind: "conflict" });
	});

	it("two devices: the second postponement fails for good and the screen goes back to the server", async () => {
		const server = createFakeServer(NOW);
		const habitId = monthlyOnServer(server);
		const { engine, repository, newId } = await setup({ server });
		await engine.sync("launch");

		engine.setOnline(false);
		await repository.rescheduleHabit(habitId, request(newId(), "2026-10-20"));
		// Meanwhile the other phone postponed the same occurrence.
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "reschedule.create",
			habit_id: habitId,
			...request(uuidV7(NOW, randomBytes()), "2026-10-14"),
			action_date: TODAY,
		});

		engine.setOnline(true);
		await engine.sync("manual");
		expect(engine.getStatus()).toMatchObject({ pending: 0, failed: 1 });
		// The failed one is no longer replayed: the server's date shows.
		expect(
			(await repository.getDay("2026-10-14")).possible_habits.map((h) => h.id)
		).toEqual([habitId]);
		expect((await repository.getDay("2026-10-20")).possible_habits).toEqual([]);
	});

	it("undo before syncing leaves the server untouched", async () => {
		const server = createFakeServer(NOW);
		const habitId = monthlyOnServer(server);
		const { engine, repository, newId } = await setup({ server });
		await engine.sync("launch");
		engine.setOnline(false);
		const id = newId();
		await repository.rescheduleHabit(habitId, request(id, "2026-10-16"));
		await repository.undoReschedule(habitId, id);
		expect(
			(await repository.getDay(TODAY)).possible_habits.map((h) => h.id)
		).toEqual([habitId]);
		engine.setOnline(true);
		await engine.sync("manual");
		expect(server.state.reschedules.get(id)?.deleted_at).toBe(NOW);
		expect(
			(await repository.getDay(TODAY)).possible_habits.map((h) => h.id)
		).toEqual([habitId]);
	});

	it("pulls everything once more when the mirror predates postponements", async () => {
		const server = createFakeServer(NOW);
		const habitId = monthlyOnServer(server);
		const store = createLocalStore(async () => openNodeDatabase());
		const first = await setup({ server, store });
		await first.engine.sync("launch");
		// A mirror pulled by 2.15.0: no `mirror_version`, and a postponement
		// the web wrote before this build is behind the cursor.
		await store.setMeta("mirror_version", null);
		server.write({
			mutation_id: uuidV7(NOW, randomBytes()),
			created_at: NOW,
			type: "reschedule.create",
			habit_id: habitId,
			...request(uuidV7(NOW, randomBytes()), "2026-10-14"),
			action_date: TODAY,
		});
		await first.engine.sync("manual");
		expect(server.calls.pull.at(-1)).toBeNull();
		expect((await store.getMeta("mirror_version")) ?? "").toBe("2");
		expect(
			(await first.repository.getDay("2026-10-14")).possible_habits.map(
				(h) => h.id
			)
		).toEqual([habitId]);
	});
});
