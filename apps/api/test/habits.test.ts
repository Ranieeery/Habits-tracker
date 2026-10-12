import type { Habit } from "@habits/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, json, makeApi, resetDb } from "./helpers.ts";

beforeEach(resetDb);

const NOW = "2026-10-09T15:00:00Z";
const NOW_MS = Date.parse(NOW);
const WEEKDAYS = { type: "weekdays", days: [1, 2, 3, 4, 5] };

async function setup() {
	const api = makeApi(NOW);
	const owner = await createUser(api, "owner@example.com");
	const post = (body: unknown) =>
		api.request(
			"/v1/habits",
			json(body, { method: "POST", headers: owner.auth() })
		);
	const patch = (id: string, body: unknown) =>
		api.request(
			`/v1/habits/${id}`,
			json(body, { method: "PATCH", headers: owner.auth() })
		);
	const list = async () => {
		const response = await api.request("/v1/habits", {
			headers: owner.auth(),
		});
		return ((await response.json()) as { habits: Habit[] }).habits;
	};
	return { api, owner, post, patch, list };
}

const habitOf = async (response: Response) =>
	((await response.json()) as { habit: Habit }).habit;

describe("POST /v1/habits", () => {
	it("creates a habit with the client id", async () => {
		const { post, list } = await setup();
		const id = "0199c9a0-2222-7000-8000-000000000001";

		const response = await post({
			id,
			name: "  Ler  ",
			schedule: WEEKDAYS,
			start_date: "2026-10-09",
		});

		expect(response.status).toBe(201);
		const habit = await habitOf(response);
		expect(habit).toEqual({
			id,
			name: "Ler",
			schedule: WEEKDAYS,
			start_date: "2026-10-09",
			archived_at: null,
			created_at: NOW_MS,
			updated_at: NOW_MS,
			deleted_at: null,
		});
		expect(await list()).toEqual([habit]);
	});

	it("is idempotent for a retried id", async () => {
		const { post, list } = await setup();
		const body = {
			id: "0199c9a0-2222-7000-8000-000000000001",
			name: "Ler",
			schedule: WEEKDAYS,
			start_date: "2026-10-09",
		};

		const first = await habitOf(await post(body));
		const retry = await post(body);

		expect(retry.status).toBe(200);
		expect(await habitOf(retry)).toEqual(first);
		expect(await list()).toHaveLength(1);
	});

	it("rejects a start date before the backfill window", async () => {
		const { post } = await setup();
		const response = await post({
			name: "Ler",
			schedule: WEEKDAYS,
			start_date: "2026-09-08",
		});
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "date_out_of_range", details: { earliest: "2026-09-09" } },
		});
	});

	it.each([
		["an empty name", { name: " ", schedule: WEEKDAYS }],
		[
			"an empty schedule",
			{ name: "Ler", schedule: { type: "weekdays", days: [] } },
		],
		[
			"an unknown schedule type",
			{ name: "Ler", schedule: { type: "monthly" } },
		],
	])("rejects %s", async (_, fields) => {
		const { post } = await setup();
		const response = await post({ ...fields, start_date: "2026-10-09" });
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});
});

describe("PATCH /v1/habits/{habit_id}", () => {
	it("renames, reschedules, archives and unarchives", async () => {
		const { api, post, patch, list } = await setup();
		const created = await habitOf(
			await post({ name: "Ler", schedule: WEEKDAYS, start_date: "2026-10-09" })
		);

		api.setNow("2026-10-09T16:00:00Z");
		const renamed = await habitOf(
			await patch(created.id, {
				name: "Ler 20 páginas",
				schedule: { type: "weekdays", days: [0, 6] },
			})
		);
		expect(renamed).toMatchObject({
			name: "Ler 20 páginas",
			schedule: { type: "weekdays", days: [0, 6] },
			archived_at: null,
			created_at: NOW_MS,
			updated_at: Date.parse("2026-10-09T16:00:00Z"),
		});

		api.setNow("2026-10-09T17:00:00Z");
		const archived = await habitOf(await patch(created.id, { archived: true }));
		expect(archived.archived_at).toBe(Date.parse("2026-10-09T17:00:00Z"));

		// Archiving again keeps the original instant.
		api.setNow("2026-10-09T18:00:00Z");
		const again = await habitOf(await patch(created.id, { archived: true }));
		expect(again.archived_at).toBe(archived.archived_at);
		expect(await list()).toEqual([again]);

		const unarchived = await habitOf(
			await patch(created.id, { archived: false })
		);
		expect(unarchived.archived_at).toBeNull();
	});

	it("answers 404 for an unknown habit", async () => {
		const { patch } = await setup();
		const response = await patch("0199c9a0-9999-7000-8000-000000000001", {
			name: "x",
		});
		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({
			error: { code: "not_found" },
		});
	});
});
