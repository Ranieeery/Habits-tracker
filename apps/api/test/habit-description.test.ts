// Habit descriptions (2.12.0): REST and sync writes per field, the limit,
// the `server_seq` bump (the column is not in the trigger's list) and the
// additive migration 0007.
import type {
	Habit,
	SyncPullResponse,
	SyncPushResponse,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { habits } from "../src/db/schema.ts";
import { uuidV7 } from "../src/lib/ids.ts";
import {
	createUser,
	db,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";

const TODAY = "2026-10-09";
const NOW = `${TODAY}T15:00:00Z`;
const NOW_MS = Date.parse(NOW);
const WEEKDAYS = { type: "weekdays", days: [1, 2, 3, 4, 5] };
const TEXT = "**Treino A**\n- agachamento\n- [planilha](https://exemplo.com)";

let api: TestApi;
let owner: TestUser;

beforeEach(async () => {
	await resetDb();
	api = makeApi(NOW);
	owner = await createUser(api, "owner@example.com");
});

const post = (body: Record<string, unknown>) =>
	api.request(
		"/v1/habits",
		json(
			{ name: "Ler", schedule: WEEKDAYS, start_date: TODAY, ...body },
			{ method: "POST", headers: owner.auth() }
		)
	);
const patch = (habitId: string, body: unknown) =>
	api.request(
		`/v1/habits/${habitId}`,
		json(body, { method: "PATCH", headers: owner.auth() })
	);
const habitOf = async (response: Response) =>
	((await response.json()) as { habit: Habit }).habit;
async function pull(cursor?: string): Promise<SyncPullResponse> {
	const response = await api.request(
		`/v1/sync/pull${cursor ? `?cursor=${cursor}` : ""}`,
		{ headers: owner.auth() }
	);
	return (await response.json()) as SyncPullResponse;
}

describe("REST", () => {
	it("creates a habit with no description (empty) or with one", async () => {
		const plain = await habitOf(await post({}));
		const described = await habitOf(await post({ description: `  ${TEXT}\n` }));
		expect(plain.description).toBe("");
		expect(described.description).toBe(TEXT);
	});

	it("changes the description alone, and a rename keeps it", async () => {
		const created = await habitOf(await post({ description: "Antes" }));
		api.setNow("2026-10-09T15:01:00Z");

		const described = await habitOf(
			await patch(created.id, { description: TEXT })
		);
		expect(described).toMatchObject({
			name: "Ler",
			description: TEXT,
			updated_at: Date.parse("2026-10-09T15:01:00Z"),
		});
		const renamed = await habitOf(
			await patch(created.id, { name: "Ler mais" })
		);
		expect(renamed).toMatchObject({ name: "Ler mais", description: TEXT });
		const cleared = await habitOf(await patch(created.id, { description: "" }));
		expect(cleared.description).toBe("");
	});

	it("refuses more than 5000 characters (422) and accepts exactly 5000", async () => {
		expect((await post({ description: "a".repeat(5001) })).status).toBe(422);
		const created = await habitOf(
			await post({ description: "a".repeat(5000) })
		);
		expect(created.description).toHaveLength(5000);
		expect(
			(await patch(created.id, { description: "b".repeat(5001) })).status
		).toBe(422);
	});

	it("bumps server_seq, so a pull delivers a description change", async () => {
		const created = await habitOf(await post({}));
		const { cursor } = await pull();

		await patch(created.id, { description: TEXT });

		const page = await pull(cursor);
		expect(page.changes.habits).toHaveLength(1);
		expect(page.changes.habits[0]).toMatchObject({
			id: created.id,
			description: TEXT,
		});
	});
});

describe("sync", () => {
	const push = async (mutations: unknown[]) => {
		const response = await api.request(
			"/v1/sync/push",
			json(
				{ protocol: 1, mutations },
				{ method: "POST", headers: owner.auth() }
			)
		);
		expect(response.status).toBe(200);
		return ((await response.json()) as SyncPushResponse).results;
	};
	const id = () => uuidV7(NOW_MS);

	it("creates and edits descriptions; mutations without the field still apply", async () => {
		const described = id();
		const old = id();
		const results = await push([
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.create",
				id: described,
				name: "Treinar",
				description: TEXT,
				schedule: WEEKDAYS,
				start_date: TODAY,
			},
			// As sent by apps older than 2.12.0.
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.create",
				id: old,
				name: "Ler",
				schedule: WEEKDAYS,
				start_date: TODAY,
			},
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.update",
				habit_id: old,
				changes: { name: "Ler 20 páginas" },
			},
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.update",
				habit_id: described,
				changes: { description: "Treino B" },
			},
		]);

		expect(results.map((r) => r.status)).toEqual([
			"applied",
			"applied",
			"applied",
			"applied",
		]);
		const rows = await db
			.select()
			.from(habits)
			.where(eq(habits.user_id, owner.id));
		const byId = new Map(rows.map((row) => [row.id, row]));
		expect(byId.get(described)?.description).toBe("Treino B");
		expect(byId.get(old)).toMatchObject({
			name: "Ler 20 páginas",
			description: "",
		});
	});

	it("rejects a description over the limit alone", async () => {
		const [result] = await push([
			{
				mutation_id: id(),
				created_at: NOW_MS,
				type: "habit.create",
				id: id(),
				name: "Ler",
				description: "a".repeat(5001),
				schedule: WEEKDAYS,
				start_date: TODAY,
			},
		]);
		expect(result?.error?.code).toBe("validation_error");
	});
});

describe("migration 0007", () => {
	it("only adds the column, with '' for rows written without it", async () => {
		const migration = env.TEST_MIGRATIONS.find((m) =>
			m.name.startsWith("0007")
		)!;
		const statements = migration.queries.map((q) =>
			q.replace(/^\s*(?:--[^\n]*\n\s*)*/, "").trim()
		);
		expect(statements).toEqual([
			"ALTER TABLE `habits` ADD `description` text DEFAULT '' NOT NULL",
		]);

		// A row inserted the way a 2.11.0 API does (no description column).
		await env.DB.prepare(
			"INSERT INTO habits (id, user_id, name, schedule, start_date, created_at, updated_at) VALUES (?, ?, 'Antigo', ?, ?, ?, ?)"
		)
			.bind(
				uuidV7(NOW_MS),
				owner.id,
				JSON.stringify(WEEKDAYS),
				TODAY,
				NOW_MS,
				NOW_MS
			)
			.run();
		const response = await api.request("/v1/habits", {
			headers: owner.auth(),
		});
		const { habits: listed } = (await response.json()) as { habits: Habit[] };
		expect(listed.map((h) => [h.name, h.description])).toEqual([
			["Antigo", ""],
		]);
	});
});
