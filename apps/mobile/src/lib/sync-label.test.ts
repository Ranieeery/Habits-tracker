import { describe, expect, it } from "vitest";
import { isClockSkewed, syncLabel } from "./sync-label.ts";

const base = {
	state: "idle" as const,
	error: null,
	pending: 0,
	failed: 0,
	lastSyncedAt: null,
};

describe("syncLabel", () => {
	it.each([
		[{}, "ok", "Sincronizado"],
		[{ state: "syncing" as const }, "busy", "Sincronizando…"],
		[{ pending: 1 }, "pending", "1 pendente"],
		[{ pending: 3 }, "pending", "3 pendentes"],
		[{ state: "offline" as const }, "offline", "Offline"],
		[
			{ state: "offline" as const, pending: 2 },
			"offline",
			"Offline · 2 pendentes",
		],
		[{ failed: 1, pending: 4 }, "danger", "1 falha"],
		[
			{ state: "error" as const, error: "server" as const },
			"pending",
			"Erro ao sincronizar",
		],
		[
			{ state: "error" as const, error: "unauthorized" as const },
			"danger",
			"Sessão expirada",
		],
	])("%o -> %s %s", (status, tone, label) => {
		expect(syncLabel({ ...base, ...status })).toMatchObject({ tone, label });
	});

	it("says when it last synced", () => {
		expect(
			syncLabel({
				...base,
				lastSyncedAt: new Date(2026, 9, 9, 14, 5).getTime(),
			}).label
		).toBe("Sincronizado às 14:05");
	});
});

describe("isClockSkewed", () => {
	it("warns past five minutes either way", () => {
		expect(isClockSkewed(null)).toBe(false);
		expect(isClockSkewed(60_000)).toBe(false);
		expect(isClockSkewed(6 * 60_000)).toBe(true);
		expect(isClockSkewed(-6 * 60_000)).toBe(true);
	});
});
