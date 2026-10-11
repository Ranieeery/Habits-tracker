import type { Completion, Mutation } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrate } from "./migrations.ts";
import { createLocalStore } from "./store.ts";
import { openNodeDatabase } from "./testing/node-sql.ts";

const HABIT = "00000000-0000-7000-8000-000000000001";
const id = (n: number) =>
	`00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function completion(
	n: number,
	overrides: Partial<Completion> = {}
): Completion {
	return {
		id: id(n),
		habit_id: HABIT,
		date: "2026-10-09",
		completed_at: 1,
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

function set(n: number, completionId: string, completed = true): Mutation {
	return {
		mutation_id: id(100 + n),
		created_at: 1,
		type: "completion.set",
		id: completionId,
		habit_id: HABIT,
		date: "2026-10-09",
		completed,
	};
}

describe("local migrations", () => {
	it("bring an empty database to the latest version, once", async () => {
		const db = openNodeDatabase();
		expect(await migrate(db)).toBe(MIGRATIONS.length);
		expect(await migrate(db)).toBe(MIGRATIONS.length);
		const row = await db.first<{ user_version: number }>("PRAGMA user_version");
		expect(row?.user_version).toBe(MIGRATIONS.length);
	});
});

describe("local store", () => {
	const open = () => createLocalStore(async () => openNodeDatabase());

	it("keeps the server's id when a pulled completion has the same habit and date", async () => {
		const store = open();
		await store.applyPullPage({
			changes: { habits: [], completions: [completion(1)] },
			cursor: "1.1",
			has_more: false,
		});
		await store.applyPullPage({
			changes: {
				habits: [],
				completions: [completion(2, { deleted_at: 5 })],
			},
			cursor: "1.2",
			has_more: false,
		});
		const { completions } = await store.readMirror();
		expect(completions).toEqual([completion(2, { deleted_at: 5 })]);
		expect(await store.getMeta("cursor")).toBe("1.2");
	});

	it("keeps applied entries until the last page of a pull, then drops them", async () => {
		const store = open();
		const entry = set(1, id(1));
		await store.enqueue(entry, 1);
		const sent = await store.readOutbox();
		await store.applyPushResults(sent, [
			{
				mutation_id: entry.mutation_id,
				status: "applied",
				canonical_id: id(1),
			},
		]);
		expect((await store.readOutbox())[0]?.state).toBe("applied");
		expect(await store.counts()).toEqual({ pending: 0, failed: 0 });

		const page = { changes: { habits: [], completions: [] }, cursor: "1.3" };
		await store.applyPullPage({ ...page, has_more: true });
		expect(await store.readOutbox()).toHaveLength(1);
		await store.applyPullPage({ ...page, has_more: false });
		expect(await store.readOutbox()).toEqual([]);
	});

	it("replaces a local completion id with the canonical one in kept entries", async () => {
		const store = open();
		const first = set(1, id(1));
		const later = set(2, id(1), false);
		await store.enqueue(first, 1);
		await store.enqueue(later, 2);
		const [sent] = await store.readOutbox();
		await store.applyPushResults(
			[sent!],
			[
				{
					mutation_id: first.mutation_id,
					status: "applied",
					canonical_id: id(9),
				},
			]
		);
		const outbox = await store.readOutbox();
		expect(
			outbox.map((e) => [e.state, (e.mutation as { id: string }).id])
		).toEqual([
			["applied", id(9)],
			["pending", id(9)],
		]);
	});

	it("records rejections as failures, and retry puts them back in place", async () => {
		const store = open();
		const entry = set(1, id(1));
		await store.enqueue(entry, 1);
		await store.applyPushResults(await store.readOutbox(), [
			{
				mutation_id: entry.mutation_id,
				status: "rejected",
				error: { code: "date_out_of_range", message: "Too old" },
			},
		]);
		expect(await store.counts()).toEqual({ pending: 0, failed: 1 });
		const [failed] = await store.readOutbox();
		expect(failed).toMatchObject({ state: "failed", attempts: 1 });
		expect(failed?.lastError?.code).toBe("date_out_of_range");

		await store.retry([entry.mutation_id]);
		expect(await store.counts()).toEqual({ pending: 1, failed: 0 });
		await store.discard([entry.mutation_id]);
		expect(await store.readOutbox()).toEqual([]);
	});

	it("wipes everything for another user, nothing for the same one", async () => {
		const store = open();
		expect(await store.ensureUser("a")).toBe(false);
		await store.enqueue(set(1, id(1)), 1);
		expect(await store.ensureUser("a")).toBe(false);
		expect(await store.readOutbox()).toHaveLength(1);
		expect(await store.ensureUser("b")).toBe(true);
		expect(await store.readOutbox()).toEqual([]);
		expect(await store.getMeta("user_id")).toBe("b");
		await store.wipe();
		expect(await store.getMeta("user_id")).toBeNull();
	});

	it("lends the lease to one owner at a time until it expires", async () => {
		const store = open();
		expect(await store.acquireLease("app", 1000, 60_000)).toBe(true);
		expect(await store.acquireLease("task", 2000, 60_000)).toBe(false);
		expect(await store.acquireLease("app", 3000, 60_000)).toBe(true);
		// A crashed holder's lease runs out.
		expect(await store.acquireLease("task", 63_001, 60_000)).toBe(true);
		await store.releaseLease("app"); // not the holder: no effect
		expect(await store.acquireLease("app", 63_002, 60_000)).toBe(false);
	});
});
