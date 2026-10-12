import { beforeEach, describe, expect, it } from "vitest";
import { createUser, json, makeApi, resetDb } from "./helpers.ts";

beforeEach(resetDb);

async function setup() {
	const api = makeApi("2026-10-09T15:00:00Z");
	const owner = await createUser(api, "owner@example.com");
	const patch = (body: unknown) =>
		api.request(
			"/v1/settings",
			json(body, { method: "PATCH", headers: owner.auth() })
		);
	return { api, owner, patch };
}

describe("/v1/settings", () => {
	it("starts with the defaults", async () => {
		const { api, owner } = await setup();
		const response = await api.request("/v1/settings", {
			headers: owner.auth(),
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			settings: { timezone: "America/Sao_Paulo", reminder_time: null },
		});
	});

	it("updates the time zone and the reminder time", async () => {
		const { api, patch } = await setup();
		api.setNow("2026-10-09T16:00:00Z");

		const response = await patch({
			timezone: "Europe/Lisbon",
			reminder_time: "21:30",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			settings: {
				timezone: "Europe/Lisbon",
				reminder_time: "21:30",
				updated_at: Date.parse("2026-10-09T16:00:00Z"),
			},
		});
		const off = await patch({ reminder_time: null });
		expect(await off.json()).toMatchObject({
			settings: { timezone: "Europe/Lisbon", reminder_time: null },
		});
	});

	it.each([
		[{ timezone: "Mars/Olympus" }],
		[{ timezone: "" }],
		[{ reminder_time: "24:00" }],
		[{ reminder_time: "9:00" }],
	])("rejects %j", async (body) => {
		const { patch } = await setup();
		const response = await patch(body);
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});
});

describe("2.2.0 notification settings", () => {
	it("defaults the morning digest and titles to on, and updates them", async () => {
		const { api, owner, patch } = await setup();
		const initial = await api.request("/v1/settings", {
			headers: owner.auth(),
		});
		expect(await initial.json()).toMatchObject({
			settings: {
				morning_digest_enabled: true,
				show_titles_in_notifications: true,
			},
		});

		const response = await patch({
			morning_digest_enabled: false,
			show_titles_in_notifications: false,
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			settings: {
				morning_digest_enabled: false,
				show_titles_in_notifications: false,
			},
		});
	});

	it("accepts reminder times in 15-minute steps only", async () => {
		const { patch } = await setup();
		expect((await patch({ reminder_time: "20:45" })).status).toBe(200);
		const offStep = await patch({ reminder_time: "20:07" });
		expect(offStep.status).toBe(422);
		expect(await offStep.json()).toMatchObject({
			error: { code: "validation_error" },
		});
	});
});
