// GET /v1/day and /v1/summary against the dev seed, compared with what
// `@habits/core` computes from the same records.
import type { DayResponse, SummaryResponse } from "@habits/contracts";
import { eachDay, isHabitPossibleOn, summarizeDay } from "@habits/core";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password.ts";
import { applySeed } from "../src/db/seed/apply.ts";
import {
	buildSeed,
	DEV_USER_EMAIL,
	DEV_USER_PASSWORD,
	SEED_TIME_ZONE,
} from "../src/db/seed/build.ts";
import { bearerOf, db, makeApi, resetDb, signIn } from "./helpers.ts";

const seed = buildSeed();
const options = { timeZone: SEED_TIME_ZONE };
// Midday of the seed's "today" in São Paulo.
const api = makeApi(`${seed.today}T15:00:00Z`);
let headers: Record<string, string>;

beforeAll(async () => {
	await resetDb();
	await applySeed(db, seed, await hashPassword(DEV_USER_PASSWORD));
	const response = await signIn(api, DEV_USER_EMAIL, DEV_USER_PASSWORD);
	headers = { Authorization: `Bearer ${bearerOf(response)}` };
});

async function getDay(date: string): Promise<DayResponse> {
	const response = await api.request(`/v1/day?date=${date}`, { headers });
	expect(response.status).toBe(200);
	return (await response.json()) as DayResponse;
}

async function getSummary(year: number): Promise<SummaryResponse> {
	const response = await api.request(`/v1/summary?year=${year}`, { headers });
	expect(response.status).toBe(200);
	return (await response.json()) as SummaryResponse;
}

describe("GET /v1/day", () => {
	it.each([seed.today, "2026-01-01", "2025-12-31", "2026-06-15"])(
		"matches core for %s",
		async (date) => {
			const day = await getDay(date);
			const possible = seed.habits.filter((habit) =>
				isHabitPossibleOn(habit, date, options)
			);
			const done = seed.completions
				.filter((c) => c.date === date && c.deleted_at === null)
				.map((c) => c.habit_id);

			expect(day.date).toBe(date);
			expect(day.possible_habits.map((h) => h.id).sort()).toEqual(
				possible.map((h) => h.id).sort()
			);
			expect(day.completed_habit_ids.sort()).toEqual(
				possible
					.map((h) => h.id)
					.filter((id) => done.includes(id))
					.sort()
			);
		}
	);

	it("still lists a habit on the day it was archived, not after", async () => {
		const archived = seed.habits.find((habit) => habit.archived_at !== null)!;
		const archivedDay = new Intl.DateTimeFormat("en-CA", {
			timeZone: SEED_TIME_ZONE,
		}).format(archived.archived_at!);
		const scheduledOn = (date: string) =>
			isHabitPossibleOn({ ...archived, archived_at: null }, date, options);

		if (scheduledOn(archivedDay)) {
			const day = await getDay(archivedDay);
			expect(day.possible_habits.map((h) => h.id)).toContain(archived.id);
		}
		const later = eachDay(archivedDay, seed.today).slice(1).find(scheduledOn)!;
		const day = await getDay(later);
		expect(day.possible_habits.map((h) => h.id)).not.toContain(archived.id);
	});

	it("rejects an invalid date", async () => {
		const response = await api.request("/v1/day?date=2026-13-01", {
			headers,
		});
		expect(response.status).toBe(422);
	});
});

describe("GET /v1/summary", () => {
	const year = Number(seed.today.slice(0, 4));

	it("matches core for every day of the year up to today", async () => {
		const summary = await getSummary(year);
		const expected = eachDay(`${year}-01-01`, seed.today)
			.map((date) => ({
				date,
				...summarizeDay(seed.habits, seed.completions, date, options),
			}))
			.filter((day) => day.possible > 0);

		expect(summary).toEqual({ year, days: expected });
		expect(summary.days.at(-1)?.date).toBe(seed.today);
	});

	it("covers the previous year up to December 31", async () => {
		const summary = await getSummary(year - 1);
		const last = summary.days.at(-1)!;
		expect(last.date).toBe(`${year - 1}-12-31`);
		expect(last).toEqual({
			date: last.date,
			...summarizeDay(seed.habits, seed.completions, last.date, options),
		});
	});

	it("is empty for a future year", async () => {
		expect(await getSummary(year + 1)).toEqual({ year: year + 1, days: [] });
	});
});
