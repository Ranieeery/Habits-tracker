import type { Completion, Habit } from "@habits/contracts";
import { BACKFILL_DAYS } from "@habits/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
	createUser,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";

beforeEach(resetDb);

const EVERY_DAY = { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] };

async function setup(now: string) {
	const api = makeApi(now, { ALLOW_SIGNUP: "true" });
	const owner = await createUser(api, "owner@example.com");
	const response = await api.request(
		"/v1/habits",
		json(
			{ name: "Beber água", schedule: EVERY_DAY, start_date: "2026-09-09" },
			{ method: "POST", headers: owner.auth() }
		)
	);
	expect(response.status).toBe(201);
	const { habit } = (await response.json()) as { habit: Habit };
	return { api, owner, habit };
}

function setCompletion(
	api: TestApi,
	owner: TestUser,
	habitId: string,
	date: string,
	body: { completed: boolean; id?: string }
) {
	return api.request(
		`/v1/habits/${habitId}/completions/${date}`,
		json(body, { method: "PUT", headers: owner.auth() })
	);
}

async function completionOf(response: Response): Promise<Completion> {
	return ((await response.json()) as { completion: Completion }).completion;
}

describe("write window (America/Sao_Paulo)", () => {
	// 2026-10-10 02:59:59 UTC is still 2026-10-09 23:59:59 in São Paulo (UTC-3).
	const LAST_SECOND_OF_OCT_9 = "2026-10-10T02:59:59Z";
	const FIRST_SECOND_OF_OCT_10 = "2026-10-10T03:00:00Z";

	it.each([
		["today", "2026-10-09", 200],
		["tomorrow (upper limit)", "2026-10-10", 200],
		[`today - ${BACKFILL_DAYS} (lower limit)`, "2026-09-09", 200],
		["two days ahead", "2026-10-11", 422],
		[`today - ${BACKFILL_DAYS + 1}`, "2026-09-08", 422],
	])("with today = 2026-10-09, %s (%s) -> %i", async (_, date, status) => {
		const { api, owner, habit } = await setup(LAST_SECOND_OF_OCT_9);

		const response = await setCompletion(api, owner, habit.id, date, {
			completed: true,
		});

		expect(response.status).toBe(status);
		if (status === 422) {
			expect(await response.json()).toMatchObject({
				error: {
					code: "date_out_of_range",
					details: { from: "2026-09-09", to: "2026-10-10" },
				},
			});
		}
	});

	it("moves with the user's day, not the UTC day", async () => {
		const { api, owner, habit } = await setup(LAST_SECOND_OF_OCT_9);
		const put = (date: string) =>
			setCompletion(api, owner, habit.id, date, { completed: true });

		// Still the 9th locally: the 11th is two days ahead, 09/09 is -30.
		expect((await put("2026-10-11")).status).toBe(422);
		expect((await put("2026-09-09")).status).toBe(200);

		// One second later it is the 10th in São Paulo: 09/09 is now -31.
		api.setNow(FIRST_SECOND_OF_OCT_10);
		expect((await put("2026-10-11")).status).toBe(200);
		expect((await put("2026-09-09")).status).toBe(422);
		expect((await put("2026-09-10")).status).toBe(200);
	});

	it("follows the time zone in the user's settings", async () => {
		const { api, owner, habit } = await setup(LAST_SECOND_OF_OCT_9);
		await api.request(
			"/v1/settings",
			json(
				{ timezone: "Asia/Tokyo" },
				{ method: "PATCH", headers: owner.auth() }
			)
		);

		// 02:59 UTC is 11:59 on the 10th in Tokyo: the 11th is now tomorrow.
		const response = await setCompletion(api, owner, habit.id, "2026-10-11", {
			completed: true,
		});
		expect(response.status).toBe(200);
	});
});

describe("PUT /v1/habits/{habit_id}/completions/{date}", () => {
	const NOW = "2026-10-09T15:00:00Z";
	const NOW_MS = Date.parse(NOW);

	it("marks done with the client id, idempotently", async () => {
		const { api, owner, habit } = await setup(NOW);
		const id = "0199c9a0-1111-7000-8000-000000000001";

		const first = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: true,
				id,
			})
		);
		api.setNow("2026-10-09T16:00:00Z");
		const again = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: true,
				id: "0199c9a0-1111-7000-8000-000000000002",
			})
		);

		expect(first).toEqual({
			id,
			habit_id: habit.id,
			date: "2026-10-09",
			completed_at: NOW_MS,
			created_at: NOW_MS,
			updated_at: NOW_MS,
			deleted_at: null,
		});
		expect(again).toEqual(first);
	});

	it("generates a UUID v7 when the client sends no id", async () => {
		const { api, owner, habit } = await setup(NOW);
		const completion = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: true,
			})
		);
		expect(completion.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});

	it("un-checks with a tombstone and revives the same row", async () => {
		const { api, owner, habit } = await setup(NOW);
		const done = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: true,
			})
		);

		api.setNow("2026-10-09T16:00:00Z");
		const undone = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: false,
			})
		);
		expect(undone).toMatchObject({
			id: done.id,
			completed_at: NOW_MS,
			deleted_at: Date.parse("2026-10-09T16:00:00Z"),
		});

		api.setNow("2026-10-09T17:00:00Z");
		const revived = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-09", {
				completed: true,
			})
		);
		const at = Date.parse("2026-10-09T17:00:00Z");
		expect(revived).toMatchObject({
			id: done.id,
			completed_at: at,
			updated_at: at,
			deleted_at: null,
		});
	});

	it("records an un-check without a previous row as a tombstone", async () => {
		const { api, owner, habit } = await setup(NOW);
		const completion = await completionOf(
			await setCompletion(api, owner, habit.id, "2026-10-08", {
				completed: false,
			})
		);
		expect(completion.deleted_at).toBe(NOW_MS);

		const day = await api.request("/v1/day?date=2026-10-08", {
			headers: owner.auth(),
		});
		expect(await day.json()).toMatchObject({ completed_habit_ids: [] });
	});

	it("un-checks a past day with a tombstone, only for that date", async () => {
		const { api, owner, habit } = await setup(NOW);
		const pastDay = "2026-09-19"; // 20 days ago
		const done = await completionOf(
			await setCompletion(api, owner, habit.id, pastDay, { completed: true })
		);
		await setCompletion(api, owner, habit.id, "2026-09-20", {
			completed: true,
		});

		api.setNow("2026-10-09T16:00:00Z");
		const undone = await completionOf(
			await setCompletion(api, owner, habit.id, pastDay, { completed: false })
		);
		expect(undone).toMatchObject({
			id: done.id,
			date: pastDay,
			deleted_at: Date.parse("2026-10-09T16:00:00Z"),
		});

		const day = (date: string) =>
			api
				.request(`/v1/day?date=${date}`, { headers: owner.auth() })
				.then((response) => response.json());
		expect(await day(pastDay)).toMatchObject({ completed_habit_ids: [] });
		expect(await day("2026-09-20")).toMatchObject({
			completed_habit_ids: [habit.id],
		});
	});

	it("never writes a past day of another user's habit", async () => {
		const { api, owner, habit } = await setup(NOW);
		await setCompletion(api, owner, habit.id, "2026-09-19", {
			completed: true,
		});
		const intruder = await createUser(api, "intruder@example.com");

		const response = await setCompletion(
			api,
			intruder,
			habit.id,
			"2026-09-19",
			{
				completed: false,
			}
		);
		expect(response.status).toBe(404);

		const day = await api.request("/v1/day?date=2026-09-19", {
			headers: owner.auth(),
		});
		expect(await day.json()).toMatchObject({ completed_habit_ids: [habit.id] });
	});

	it("answers 404 for an unknown habit and 422 for invalid input", async () => {
		const { api, owner, habit } = await setup(NOW);

		const unknown = await setCompletion(
			api,
			owner,
			"0199c9a0-9999-7000-8000-000000000001",
			"2026-10-09",
			{ completed: true }
		);
		expect(unknown.status).toBe(404);

		const badDate = await setCompletion(api, owner, habit.id, "2026-02-30", {
			completed: true,
		});
		expect(badDate.status).toBe(422);
		expect(await badDate.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});
});
