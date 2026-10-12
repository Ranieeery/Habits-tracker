// User-defined order of habits (2.4.0): `sort_key` on create, PATCH and sync,
// the list order, and the 0006 backfill re-run from env.TEST_MIGRATIONS.
import { env } from "cloudflare:workers";
import type { Habit, SyncPullResponse } from "@habits/contracts";
import { initialSortKeys, keyBetween } from "@habits/core";
import { beforeEach, describe, expect, it } from "vitest";
import { habits } from "../src/db/schema.ts";
import {
	createUser,
	db,
	insertUser,
	json,
	makeApi,
	resetDb,
} from "./helpers.ts";

beforeEach(resetDb);

const NOW = "2026-10-09T15:00:00Z";
const WEEKDAYS = { type: "weekdays", days: [1, 2, 3, 4, 5] };
const id = (n: number) =>
	`0199c9a0-3333-7000-8000-${String(n).padStart(12, "0")}`;

async function setup() {
	const api = makeApi(NOW);
	const owner = await createUser(api, "owner@example.com");
	const post = (body: Record<string, unknown>) =>
		api.request(
			"/v1/habits",
			json(
				{ schedule: WEEKDAYS, start_date: "2026-10-09", ...body },
				{ method: "POST", headers: owner.auth() }
			)
		);
	const patch = (habitId: string, body: unknown) =>
		api.request(
			`/v1/habits/${habitId}`,
			json(body, { method: "PATCH", headers: owner.auth() })
		);
	const list = async () => {
		const response = await api.request("/v1/habits", { headers: owner.auth() });
		return ((await response.json()) as { habits: Habit[] }).habits;
	};
	const sync = (mutations: unknown[]) =>
		api.request(
			"/v1/sync/push",
			json(
				{ protocol: 1, mutations },
				{ method: "POST", headers: owner.auth() }
			)
		);
	const pull = async (cursor?: string) => {
		const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
		const response = await api.request(`/v1/sync/pull${query}`, {
			headers: owner.auth(),
		});
		return (await response.json()) as SyncPullResponse;
	};
	return { api, owner, post, patch, list, sync, pull };
}

const names = (list: Habit[]) => list.map((habit) => habit.name);

describe("habit order", () => {
	it("puts a habit created without a key last, and keeps a given key", async () => {
		const { post, list } = await setup();
		await post({ id: id(1), name: "Ler" });
		await post({ id: id(2), name: "Correr" });
		await post({
			id: id(3),
			name: "Meditar",
			sort_key: keyBetween(null, "a0"),
		});

		const habits = await list();
		expect(names(habits)).toEqual(["Meditar", "Ler", "Correr"]);
		expect(habits.map((h) => h.sort_key)).toEqual(["Zz", "a0", "a1"]);
	});

	it("moves a habit with PATCH (one write) and rejects malformed keys", async () => {
		const { api, post, patch, list } = await setup();
		await post({ id: id(1), name: "Ler" });
		await post({ id: id(2), name: "Correr" });
		await post({ id: id(3), name: "Meditar" });

		api.setNow("2026-10-09T16:00:00Z");
		const moved = await patch(id(3), { sort_key: keyBetween("a0", "a1") });
		expect(moved.status).toBe(200);
		const habit = ((await moved.json()) as { habit: Habit }).habit;
		expect(habit.updated_at).toBe(Date.parse("2026-10-09T16:00:00Z"));
		expect(names(await list())).toEqual(["Ler", "Meditar", "Correr"]);

		for (const sort_key of ["", "a-1", "x".repeat(65)]) {
			expect((await patch(id(1), { sort_key })).status).toBe(422);
		}
	});

	it("moves a habit through sync, and the pull carries the new key", async () => {
		const { post, sync, pull, list } = await setup();
		await post({ id: id(1), name: "Ler" });
		await post({ id: id(2), name: "Correr" });
		const before = await pull();

		const response = await sync([
			{
				mutation_id: id(100),
				created_at: Date.parse(NOW),
				type: "habit.update",
				habit_id: id(2),
				changes: { sort_key: keyBetween(null, "a0") },
			},
			// An app older than 2.4.0 creates without a key: it goes last.
			{
				mutation_id: id(101),
				created_at: Date.parse(NOW),
				type: "habit.create",
				id: id(3),
				name: "Meditar",
				schedule: WEEKDAYS,
				start_date: "2026-10-09",
			},
		]);
		expect(response.status).toBe(200);
		expect(names(await list())).toEqual(["Correr", "Ler", "Meditar"]);

		const after = await pull();
		expect(after.cursor).not.toBe(before.cursor);
		const moved = after.changes.habits.find((h) => h.id === id(2));
		expect(moved?.sort_key).toBe("Zz");
	});

	it("lists habits without a key last, by creation", async () => {
		const { owner, list } = await setup();
		const rows = [
			{ n: 1, name: "Sem chave 1", key: "", at: 1 },
			{ n: 2, name: "Com chave", key: "a5", at: 3 },
			{ n: 3, name: "Sem chave 2", key: "", at: 2 },
		];
		for (const row of rows) {
			await db.insert(habits).values({
				id: id(row.n),
				user_id: owner.id,
				name: row.name,
				schedule: { type: "weekdays", days: [1] },
				start_date: "2026-10-01",
				archived_at: null,
				sort_key: row.key,
				created_at: row.at,
				updated_at: row.at,
				deleted_at: null,
			});
		}
		expect(names(await list())).toEqual([
			"Com chave",
			"Sem chave 1",
			"Sem chave 2",
		]);
	});
});

describe("migration 0006", () => {
	it("fills keys per user in creation order and bumps the sync cursor", async () => {
		const users = [
			"0199c9a0-0000-7000-8000-0000000000b1",
			"0199c9a0-0000-7000-8000-0000000000b2",
		];
		let n = 0;
		for (const user of users) {
			await insertUser(user);
			// Created out of id order, as a 2.3.0 API wrote them (no key).
			for (const at of [30, 10, 20]) {
				await db.insert(habits).values({
					id: id(++n),
					user_id: user,
					name: `h${at}`,
					schedule: { type: "weekdays", days: [1] },
					start_date: "2026-10-01",
					archived_at: null,
					sort_key: "",
					created_at: at,
					updated_at: at,
					deleted_at: null,
				});
			}
		}
		const seqBefore = new Map(
			(await db.select().from(habits)).map((row) => [row.id, row.server_seq])
		);

		const migration = env.TEST_MIGRATIONS.find((m) =>
			m.name.startsWith("0006")
		)!;
		const update = migration.queries.filter((query) =>
			/^\s*(?:--[^\n]*\n\s*)*UPDATE/.test(query)
		);
		expect(update).toHaveLength(1);
		for (const query of update) await env.DB.prepare(query).run();

		const rows = await db.select().from(habits);
		for (const user of users) {
			const mine = rows
				.filter((row) => row.user_id === user)
				.sort((a, b) => a.created_at - b.created_at);
			expect(mine.map((row) => row.sort_key)).toEqual(["a0", "a1", "a2"]);
			expect(mine.map((row) => row.updated_at)).toEqual([10, 20, 30]);
		}
		for (const row of rows) {
			expect(row.server_seq).toBeGreaterThan(seqBefore.get(row.id)!);
		}
	});
});

// Cost (D1 Free: 5M rows read and 100k rows written per day). The migration
// and every move must stay linear: a quadratic regression (a correlated
// subquery, a renumbering on every move) would show here first.
describe("cost", () => {
	const seqOf = async (userId: string) =>
		(
			await env.DB.prepare("SELECT seq FROM sync_state WHERE user_id = ?")
				.bind(userId)
				.first<{ seq: number }>()
		)?.seq ?? 0;

	/** Seeds `perUser` key-less habits for 3 users, runs 0006's UPDATE. */
	async function migrateHabits(perUser: number) {
		await resetDb();
		const users = [
			"0199c9a0-0000-7000-8000-0000000000c1",
			"0199c9a0-0000-7000-8000-0000000000c2",
			"0199c9a0-0000-7000-8000-0000000000c3",
		];
		const insert = env.DB.prepare(
			"INSERT INTO habits (id, user_id, name, schedule, start_date, archived_at, sort_key, created_at, updated_at, deleted_at) VALUES (?, ?, ?, '{\"type\":\"weekdays\",\"days\":[1]}', '2026-10-01', NULL, '', ?, ?, NULL)"
		);
		let n = 0;
		for (const user of users) {
			await insertUser(user);
			const statements = [];
			for (let i = 0; i < perUser; i++) {
				// Created in reverse id order, so the order comes from created_at.
				const at = 10_000 - i;
				statements.push(insert.bind(id(5000 + ++n), user, `h${i}`, at, at));
			}
			for (let i = 0; i < statements.length; i += 100) {
				await env.DB.batch(statements.slice(i, i + 100));
			}
		}
		const seqBefore = await Promise.all(users.map(seqOf));
		const migration = env.TEST_MIGRATIONS.find((m) =>
			m.name.startsWith("0006")
		)!;
		const [update] = migration.queries.filter((query) =>
			/^\s*(?:--[^\n]*\n\s*)*UPDATE/.test(query)
		);
		const { meta } = await env.DB.prepare(update!).run();
		const seqAfter = await Promise.all(users.map(seqOf));
		const total = users.length * perUser;
		return {
			users,
			bumps: seqAfter.map((seq, i) => seq - seqBefore[i]!),
			readsPerHabit: meta.rows_read / total,
			writesPerHabit: meta.rows_written / total,
		};
	}

	it("migration 0006 costs the same per habit at any size (linear)", async () => {
		const small = await migrateHabits(100);
		const large = await migrateHabits(300);

		// Measured locally: about 13 reads and 6 writes per habit (the habit,
		// the sync trigger's sync_state and server_seq, the indexes). A
		// quadratic version would read ~N per habit (900 here).
		for (const run of [small, large]) {
			expect(run.writesPerHabit).toBeGreaterThan(0);
			expect(run.writesPerHabit).toBeLessThanOrEqual(8);
			expect(run.readsPerHabit).toBeLessThanOrEqual(16);
		}
		// Linear: tripling the habits does not raise the cost per habit.
		expect(large.readsPerHabit).toBeLessThanOrEqual(small.readsPerHabit * 1.1);
		expect(large.writesPerHabit).toBeLessThanOrEqual(
			small.writesPerHabit * 1.1
		);

		// One sync change per habit, keys in creation order for each user.
		expect(large.bumps).toEqual([300, 300, 300]);
		const expected = initialSortKeys(300);
		for (const user of large.users) {
			const keys = (
				await env.DB.prepare(
					"SELECT sort_key FROM habits WHERE user_id = ? ORDER BY created_at, id"
				)
					.bind(user)
					.all<{ sort_key: string }>()
			).results.map((row) => row.sort_key);
			expect(keys).toEqual(expected);
		}
	});

	it("a move changes one habit: one sync change, one record in the pull", async () => {
		const { owner, post, patch, pull } = await setup();
		for (let i = 1; i <= 20; i++) await post({ id: id(i), name: `h${i}` });
		const { cursor } = await pull();
		const before = await seqOf(owner.id);

		const response = await patch(id(20), { sort_key: keyBetween(null, "a0") });
		expect(response.status).toBe(200);
		expect(await seqOf(owner.id)).toBe(before + 1);

		const page = await pull(cursor);
		expect(page.changes.habits.map((h) => h.id)).toEqual([id(20)]);
	});
});
