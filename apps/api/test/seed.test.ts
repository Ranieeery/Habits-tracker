import {
	completionRatio,
	eachDay,
	habitStreaks,
	heatmapLevel,
	NO_RESCHEDULES,
	summarizeDay,
} from "@habits/core";
import {
	type Habit,
	SCHEDULE_VERSION,
	SCHEDULE_VERSION_HEADER,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password.ts";
import { createDb } from "../src/db/client.ts";
import { completions, habits, userSettings } from "../src/db/schema.ts";
import { applySeed } from "../src/db/seed/apply.ts";
import {
	buildSeed,
	DEFAULT_SEED_TODAY,
	DEV_USER_EMAIL,
	DEV_USER_ID,
	DEV_USER_PASSWORD,
	LONG_STREAK_DAYS,
	SEED_TIME_ZONE,
} from "../src/db/seed/build.ts";
import { validateSeed } from "../src/db/seed/validate.ts";
import { bearerOf, makeApi, signIn } from "./helpers.ts";

const seed = validateSeed(buildSeed());
const passwordHash = await hashPassword(DEV_USER_PASSWORD);
const options = { timeZone: SEED_TIME_ZONE, reschedules: NO_RESCHEDULES };
const live = seed.completions.filter((c) => c.deleted_at === null);

function streaksOf(name: string) {
	const habit = seed.habits.find((h) => h.name === name)!;
	const dates = live.filter((c) => c.habit_id === habit.id).map((c) => c.date);
	return habitStreaks(habit, dates, seed.today, options);
}

describe("buildSeed", () => {
	it("is deterministic and uses the fixed defaults", () => {
		expect(buildSeed()).toEqual(buildSeed({ today: DEFAULT_SEED_TODAY }));
		expect(seed.userId).toBe(DEV_USER_ID);
		expect(seed.today).toBe(DEFAULT_SEED_TODAY);
	});

	it("follows the reference date", () => {
		const other = validateSeed(buildSeed({ today: "2027-03-15" }));
		expect(other.completions.every((c) => c.date <= "2027-03-15")).toBe(true);
		expect(other.habits.some((h) => h.start_date === "2026-12-01")).toBe(true);
		const early = validateSeed(buildSeed({ today: "2026-03-15" }));
		expect(early.habits.every((h) => h.archived_at === null)).toBe(true);
	});

	it("has habits with different schedules and one archived", () => {
		const schedules = new Set(
			seed.habits.map((h) => JSON.stringify(h.schedule))
		);
		expect(schedules.size).toBeGreaterThanOrEqual(5);
		expect(seed.habits.filter((h) => h.archived_at !== null)).toHaveLength(1);
	});

	it("covers all 6 heatmap levels this year", () => {
		const levels = new Set(
			eachDay("2026-01-01", seed.today).map((date) => {
				const day = summarizeDay(seed.habits, seed.completions, date, options);
				return heatmapLevel(completionRatio(day.completed, day.possible));
			})
		);
		expect([...levels].sort()).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it("has a long current streak and a long broken one", () => {
		expect(streaksOf("Beber 2 litros de água").current).toBe(LONG_STREAK_DAYS);
		const read = streaksOf("Ler 20 páginas");
		expect(read.longest).toBeGreaterThanOrEqual(45);
		expect(read.current).toBeLessThan(read.longest);
	});

	it("has an un-checked completion (tombstone)", () => {
		const tombstones = seed.completions.filter((c) => c.deleted_at !== null);
		expect(tombstones).toHaveLength(1);
		expect(tombstones[0]!.updated_at).toBe(tombstones[0]!.deleted_at);
	});

	it("crosses the year boundary", () => {
		const dates = new Set(live.map((c) => c.date));
		for (const date of eachDay("2025-12-26", "2026-01-05")) {
			expect(dates.has(date), date).toBe(true);
		}
	});
});

describe("validateSeed", () => {
	it("rejects completions on dates the habit is not possible", () => {
		const habit = seed.habits.find((h) => h.name === "Treinar")!;
		const bad = {
			...seed.completions[0]!,
			habit_id: habit.id,
			date: "2026-10-04",
		};
		expect(() => validateSeed({ ...seed, completions: [bad] })).toThrow(
			/not possible/
		);
	});

	it("rejects records that break the contracts", () => {
		const bad = {
			...seed.habits[0]!,
			schedule: { type: "weekdays", days: [] },
		};
		expect(() =>
			validateSeed({ ...seed, habits: [bad as never], completions: [] })
		).toThrow();
	});
});

describe("applySeed", () => {
	it("creates the dev auth user, who can sign in and read the seeded data", async () => {
		const db = createDb(env.DB);
		await applySeed(db, seed, passwordHash);
		const api = makeApi(`${seed.today}T15:00:00Z`);

		const response = await signIn(api, DEV_USER_EMAIL, DEV_USER_PASSWORD);
		expect(response.status).toBe(200);
		const { user } = (await response.json()) as { user: { id: string } };
		expect(user.id).toBe(DEV_USER_ID);

		const authorization = `Bearer ${bearerOf(response)}`;
		const habitsResponse = await api.request("/v1/habits", {
			headers: {
				Authorization: authorization,
				[SCHEDULE_VERSION_HEADER]: String(SCHEDULE_VERSION),
			},
		});
		const body = (await habitsResponse.json()) as { habits: unknown[] };
		expect(body.habits).toHaveLength(seed.habits.length);

		// A 2.1.0 client (no header) only gets the weekday habits.
		const oldResponse = await api.request("/v1/habits", {
			headers: { Authorization: authorization },
		});
		const old = (await oldResponse.json()) as { habits: Habit[] };
		expect(old.habits.length).toBeLessThan(seed.habits.length);
		expect(old.habits.every((h) => h.schedule.type === "weekdays")).toBe(true);
	});

	it("is idempotent", async () => {
		const db = createDb(env.DB);
		const snapshot = async () => ({
			habits: await db.select().from(habits).orderBy(habits.id),
			completions: await db.select().from(completions).orderBy(completions.id),
			settings: await db.select().from(userSettings),
		});

		await applySeed(db, seed, passwordHash);
		const first = await snapshot();
		await applySeed(db, seed, passwordHash);
		const second = await snapshot();

		expect(first.habits).toHaveLength(seed.habits.length);
		expect(first.completions).toHaveLength(seed.completions.length);
		expect(second).toEqual(first);
	});

	it("leaves other users' data alone", async () => {
		const db = createDb(env.DB);
		const other = buildSeed();
		const otherUser = {
			...other,
			userId: "0199c9a0-0000-7000-8000-0000000000bb",
			user: { ...other.user, email: "other@habits.local" },
		};
		// Different ids for the second user, same shape.
		const remap = (id: string) => `${id.slice(0, -4)}ffff`;
		otherUser.habits = other.habits.map((h) => ({ ...h, id: remap(h.id) }));
		otherUser.completions = other.completions.map((c) => ({
			...c,
			id: remap(c.id),
			habit_id: remap(c.habit_id),
		}));

		await applySeed(db, otherUser, passwordHash);
		await applySeed(db, seed, passwordHash);

		expect(await db.$count(habits)).toBe(2 * seed.habits.length);
	});
});
