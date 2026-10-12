import { describe, expect, it } from "vitest";
import {
	BACKFILL_DAYS,
	isWithinWriteWindow,
	todayIn,
	writeWindow,
} from "./window.ts";

describe("write window", () => {
	it("spans BACKFILL_DAYS back and one day ahead", () => {
		expect(BACKFILL_DAYS).toBe(30);
		expect(writeWindow("2026-10-09")).toEqual({
			from: "2026-09-09",
			to: "2026-10-10",
		});
	});

	it.each([
		["2026-01-03", true], // today
		["2026-01-04", true], // +1
		["2026-01-05", false], // +2
		["2025-12-04", true], // -30, previous year
		["2025-12-03", false], // -31
	])("for today 2026-01-03, %s is allowed: %s", (date, allowed) => {
		expect(isWithinWriteWindow(date, "2026-01-03")).toBe(allowed);
	});

	it("handles a leap day inside the window", () => {
		expect(writeWindow("2024-03-02").from).toBe("2024-02-01");
		expect(isWithinWriteWindow("2024-02-29", "2024-03-02")).toBe(true);
	});
});

describe("todayIn", () => {
	it("depends on the user's time zone, not the runtime's", () => {
		// 2026-01-01T02:00Z: the Worker (UTC) is already in 2026.
		const now = Date.UTC(2026, 0, 1, 2);
		expect(todayIn("America/Sao_Paulo", now)).toBe("2025-12-31");
		expect(todayIn("UTC", now)).toBe("2026-01-01");
	});

	it("moves the window when the user changes time zone", () => {
		const now = Date.UTC(2026, 0, 1, 2);
		const spToday = todayIn("America/Sao_Paulo", now);
		const tokyoToday = todayIn("Asia/Tokyo", now);
		// 2025-12-01 is exactly -30 for São Paulo but -31 for Tokyo.
		expect(isWithinWriteWindow("2025-12-01", spToday)).toBe(true);
		expect(isWithinWriteWindow("2025-12-01", tokyoToday)).toBe(false);
	});
});
