// Database rows and contract records must not drift apart. The type checks
// run under `pnpm typecheck` (tsc -p test); the runtime checks read real rows.
import type {
	Completion,
	Habit,
	HabitReschedule,
	PushSubscription,
	UserSettings,
} from "@habits/contracts";
import { env } from "cloudflare:workers";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createDb } from "../src/db/client.ts";
import {
	fromCompletionRow,
	fromHabitRow,
	fromUserSettingsRow,
} from "../src/db/records.ts";
import type {
	CompletionRow,
	HabitRescheduleRow,
	HabitRow,
	PushSubscriptionRow,
	UserSettingsRow,
} from "../src/db/schema.ts";
import { applySeed } from "../src/db/seed/apply.ts";
import { buildSeed } from "../src/db/seed/build.ts";

type DistributiveKeyOf<T> = T extends unknown ? keyof T : never;

describe("row types", () => {
	it("are the contract records plus user_id (and the sync server_seq)", () => {
		expectTypeOf<
			Omit<HabitRow, "user_id" | "server_seq">
		>().toEqualTypeOf<Habit>();
		expectTypeOf<
			Omit<CompletionRow, "user_id" | "server_seq">
		>().toEqualTypeOf<Completion>();
		expectTypeOf<
			Omit<UserSettingsRow, "user_id">
		>().toEqualTypeOf<UserSettings>();
		expectTypeOf<
			Omit<HabitRescheduleRow, "user_id" | "server_seq">
		>().toEqualTypeOf<HabitReschedule>();
	});

	it("store every field of every push subscription kind", () => {
		expectTypeOf<PushSubscriptionRow["kind"]>().toEqualTypeOf<
			PushSubscription["kind"]
		>();
		expectTypeOf<DistributiveKeyOf<PushSubscription>>().toExtend<
			keyof PushSubscriptionRow
		>();
	});
});

describe("seeded rows", () => {
	it("parse as contract records", async () => {
		const db = createDb(env.DB);
		const seed = buildSeed();
		await applySeed(db, seed, "$scrypt$unused");

		const habits = (await db.query.habits.findMany()).map(fromHabitRow);
		const completions = (await db.query.completions.findMany()).map(
			fromCompletionRow
		);
		const settings = (await db.query.userSettings.findMany()).map(
			fromUserSettingsRow
		);

		expect(habits).toEqual(expect.arrayContaining(seed.habits));
		expect(habits).toHaveLength(seed.habits.length);
		expect(completions).toHaveLength(seed.completions.length);
		expect(settings).toEqual([seed.settings]);
	});
});
