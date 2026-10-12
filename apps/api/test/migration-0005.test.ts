// Migration 0005 over existing data: new columns get their defaults and
// reminder times off the 15-minute grid are rounded down.
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { fromUserSettingsRow } from "../src/db/records.ts";
import { userSettings } from "../src/db/schema.ts";
import { db, insertUser, resetDb } from "./helpers.ts";

beforeEach(resetDb);

const USERS = {
	"0199c9a0-0000-7000-8000-0000000000a1": "20:07",
	"0199c9a0-0000-7000-8000-0000000000a2": "23:59",
	"0199c9a0-0000-7000-8000-0000000000a3": "08:30",
	"0199c9a0-0000-7000-8000-0000000000a4": null,
} as const;

async function insertOldSettings() {
	for (const [id, time] of Object.entries(USERS)) {
		await insertUser(id);
		// As a 2.1.0 API wrote them: only the old columns.
		await env.DB.prepare(
			"INSERT INTO user_settings (user_id, timezone, reminder_time, created_at, updated_at) VALUES (?, 'America/Sao_Paulo', ?, 1, 1)"
		)
			.bind(id, time)
			.run();
	}
}

describe("migration 0005", () => {
	it("rounds reminder times down to the step and keeps the rest", async () => {
		await insertOldSettings();
		const migration = env.TEST_MIGRATIONS.find((m) =>
			m.name.startsWith("0005")
		)!;
		const update = migration.queries.filter((query) =>
			/^\s*(?:--[^\n]*\n\s*)*UPDATE/.test(query)
		);
		expect(update).toHaveLength(1);
		for (const query of update) await env.DB.prepare(query).run();

		const times = Object.fromEntries(
			(await db.select().from(userSettings)).map((row) => [
				row.user_id,
				row.reminder_time,
			])
		);
		expect(times).toEqual({
			"0199c9a0-0000-7000-8000-0000000000a1": "20:00",
			"0199c9a0-0000-7000-8000-0000000000a2": "23:45",
			"0199c9a0-0000-7000-8000-0000000000a3": "08:30",
			"0199c9a0-0000-7000-8000-0000000000a4": null,
		});
		const [untouched] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.user_id, "0199c9a0-0000-7000-8000-0000000000a3"));
		expect(untouched?.updated_at).toBe(1);
	});

	it("gives old rows the new defaults, and reads round off-step times", async () => {
		await insertOldSettings();
		const rows = await db.select().from(userSettings);
		for (const row of rows) {
			expect(row.morning_digest_enabled).toBe(true);
			expect(row.show_titles_in_notifications).toBe(true);
		}
		// Before the UPDATE (or written by a 2.1.0 API after it), reads still work.
		const off = rows.find((r) => r.reminder_time === "20:07")!;
		expect(fromUserSettingsRow(off).reminder_time).toBe("20:00");
	});
});
