// 2.2.0 schedule types on the device: they sync like any habit (the protocol
// is unchanged), the pull parse tolerates types from newer versions, and a
// mirror pulled by 2.1.0 is pulled again in full after the update.
import { SCHEDULE_VERSION, SyncPullResponse } from "@habits/contracts";
import { uuidV7 } from "@habits/core";
import { describe, expect, it } from "vitest";
import { createLocalRepository } from "../local/local-repository.ts";
import { createLocalStore } from "../local/store.ts";
import { createFakeServer } from "../local/testing/fake-server.ts";
import { openNodeDatabase } from "../local/testing/node-sql.ts";
import { createSyncEngine, type Timers } from "./engine.ts";

const NOW = Date.parse("2026-10-09T15:00:00Z"); // 12:00 in São Paulo
const TODAY = "2026-10-09";

const timers: Timers = {
	setTimeout: () => ({}),
	clearTimeout: () => {},
};

let counter = 0;
const randomBytes = () => {
	const bytes = new Uint8Array(16);
	new DataView(bytes.buffer).setUint32(12, ++counter);
	return bytes;
};

async function setup(server = createFakeServer(NOW)) {
	const store = createLocalStore(async () => openNodeDatabase());
	const engine = createSyncEngine({
		store,
		transport: server,
		now: () => NOW,
		random: () => 0.5,
		timers,
		owner: "this-device",
		onUnauthorized: () => {},
		onDataChanged: () => {},
	});
	const repository = createLocalRepository({
		store,
		remoteSettings: {
			getSettings: async () => server.settings,
			updateSettings: async () => server.settings,
		},
		now: () => NOW,
		newId: () => uuidV7(NOW, randomBytes()),
		onWrite: () => {},
	});
	await store.ensureUser("user-1");
	engine.start();
	return { server, store, engine, repository };
}

describe("new schedule types on the device", () => {
	it("creates them offline, syncs them and shows them on their days", async () => {
		const { engine, repository, server } = await setup();
		engine.setOnline(false);
		const consulta = await repository.createHabit({
			name: "Consulta",
			schedule: { type: "once", date: "2026-10-12" },
			start_date: "2026-10-12",
		});
		const filtro = await repository.createHabit({
			name: "Trocar filtro",
			schedule: { type: "interval", every: 8, anchor_date: TODAY },
			start_date: TODAY,
		});
		// Offline: the device already shows them on the right days.
		const names = async (date: string) =>
			(await repository.getDay(date)).possible_habits.map((h) => h.name);
		expect(await names(TODAY)).toEqual(["Trocar filtro"]);
		expect(await names("2026-10-12")).toEqual(["Consulta"]);
		expect(await names("2026-10-17")).toEqual(["Trocar filtro"]);

		engine.setOnline(true);
		expect(await engine.sync("manual")).toBe("synced");
		expect([...server.state.habits.keys()].sort()).toEqual(
			[consulta.id, filtro.id].sort()
		);
		await repository.setCompletion(filtro.id, TODAY, true);
		expect(await engine.sync("manual")).toBe("synced");
		expect((await repository.getDay(TODAY)).completed_habit_ids).toEqual([
			filtro.id,
		]);
	});

	it("pulls everything again once after updating from 2.1.0", async () => {
		const { engine, store, server } = await setup();
		expect(await engine.sync("launch")).toBe("synced");
		const firstCursor = server.calls.pull.at(-1);
		// What 2.1.0 left: a cursor but no schedule version.
		await store.setMeta("cursor", "1.5");
		await store.setMeta("schedule_version", null);

		expect(await engine.sync("manual")).toBe("synced");
		expect(server.calls.pull.at(-1)).toBeNull();
		expect(await store.getMeta("schedule_version")).toBe(
			String(SCHEDULE_VERSION)
		);

		await engine.sync("manual");
		expect(server.calls.pull.at(-1)).not.toBeNull();
		expect(firstCursor).toBeNull();
	});

	it("pulls everything again once after updating from 2.12 (deadline tasks, 2.13.0)", async () => {
		const { engine, store, server } = await setup();
		expect(await engine.sync("launch")).toBe("synced");
		// A 2.12 mirror: pulled with version 2, so deadline tasks were left out.
		await store.setMeta("cursor", "1.5");
		await store.setMeta("schedule_version", "2");

		expect(await engine.sync("manual")).toBe("synced");
		expect(server.calls.pull.at(-1)).toBeNull();
		expect(await store.getMeta("schedule_version")).toBe("3");
	});
});

describe("pull parsing", () => {
	it("keeps a habit whose schedule comes from a newer version", () => {
		const page = SyncPullResponse.parse({
			cursor: "1.3",
			has_more: false,
			changes: {
				habits: [
					{
						id: "0199c9a0-1111-7000-8000-000000000001",
						name: "Lua cheia",
						schedule: { type: "lunar", phase: "full" },
						start_date: TODAY,
						archived_at: null,
						created_at: 1,
						updated_at: 1,
						deleted_at: null,
					},
				],
				completions: [],
			},
		});
		expect(page.changes.habits[0]?.schedule).toEqual({
			type: "lunar",
			phase: "full",
		});
	});
});
