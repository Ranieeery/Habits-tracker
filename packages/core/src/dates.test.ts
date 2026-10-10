import { describe, expect, it } from "vitest";
import {
	addDays,
	compareDates,
	daysInYear,
	diffInDays,
	eachDay,
	epochDayOf,
	isCalendarDate,
	isValidTimeZone,
	localDateAt,
	startOfWeek,
	weekdayOf,
} from "./dates.ts";

describe("calendar arithmetic", () => {
	it("matches Date.UTC epoch days across centuries", () => {
		for (const date of [
			"1900-03-01",
			"1970-01-01",
			"1999-12-31",
			"2000-02-29",
			"2024-02-29",
			"2026-10-09",
			"2100-12-31",
		]) {
			const [y, m, d] = date.split("-").map(Number);
			expect(epochDayOf(date)).toBe(Date.UTC(y!, m! - 1, d!) / 86_400_000);
		}
	});

	it("adds days across month, year and leap boundaries", () => {
		expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
		expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
		expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
		expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
		expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
		expect(addDays("2026-01-01", 365)).toBe("2027-01-01");
	});

	it("counts days in leap and common years", () => {
		expect(daysInYear(2024)).toBe(366);
		expect(daysInYear(2026)).toBe(365);
		expect(daysInYear(1900)).toBe(365);
		expect(daysInYear(2000)).toBe(366);
		expect(diffInDays("2024-01-01", "2025-01-01")).toBe(366);
	});

	it("validates real dates only", () => {
		expect(isCalendarDate("2024-02-29")).toBe(true);
		expect(isCalendarDate("2025-02-29")).toBe(false);
		expect(isCalendarDate("2026-04-31")).toBe(false);
		expect(isCalendarDate("2026-1-1")).toBe(false);
	});

	it("derives the weekday (Sunday = 0) and the Sunday of the week", () => {
		expect(weekdayOf("2026-01-01")).toBe(4); // Thursday
		expect(weekdayOf("2023-01-01")).toBe(0); // Sunday
		expect(weekdayOf("2024-02-29")).toBe(4); // Thursday
		expect(weekdayOf("1969-12-31")).toBe(3); // before the epoch
		expect(startOfWeek("2026-01-01")).toBe("2025-12-28");
		expect(startOfWeek("2023-01-01")).toBe("2023-01-01");
	});

	it("lists days inclusively and compares dates", () => {
		expect(eachDay("2025-12-30", "2026-01-02")).toEqual([
			"2025-12-30",
			"2025-12-31",
			"2026-01-01",
			"2026-01-02",
		]);
		expect(eachDay("2026-01-02", "2026-01-01")).toEqual([]);
		expect(compareDates("2025-12-31", "2026-01-01")).toBeLessThan(0);
	});
});

describe("localDateAt", () => {
	// 2026-01-01T02:00:00Z: still New Year's Eve in São Paulo (UTC-3).
	const newYearInstant = Date.UTC(2026, 0, 1, 2);

	it("gives a different local date for the same instant per time zone", () => {
		expect(localDateAt(newYearInstant, "America/Sao_Paulo")).toBe("2025-12-31");
		expect(localDateAt(newYearInstant, "UTC")).toBe("2026-01-01");
		expect(localDateAt(newYearInstant, "Asia/Tokyo")).toBe("2026-01-01");
		// Honolulu is UTC-10: 09:59Z is 23:59, 10:00Z is midnight.
		const honolulu = "Pacific/Honolulu";
		expect(localDateAt(Date.UTC(2026, 0, 1, 9, 59), honolulu)).toBe(
			"2025-12-31"
		);
		expect(localDateAt(Date.UTC(2026, 0, 1, 10), honolulu)).toBe("2026-01-01");
	});

	it("follows DST transitions (New York, 2026-03-08)", () => {
		const tz = "America/New_York";
		// 23:59:59 EST on 03-07 and 23:59:59 EDT on 03-08.
		expect(localDateAt(Date.UTC(2026, 2, 8, 4, 59, 59), tz)).toBe("2026-03-07");
		expect(localDateAt(Date.UTC(2026, 2, 8, 5), tz)).toBe("2026-03-08");
		expect(localDateAt(Date.UTC(2026, 2, 9, 3, 59, 59), tz)).toBe("2026-03-08");
		expect(localDateAt(Date.UTC(2026, 2, 9, 4), tz)).toBe("2026-03-09");
	});

	it("handles the historical São Paulo DST midnight gap (2018-11-04)", () => {
		const tz = "America/Sao_Paulo";
		// Clocks jumped from 00:00 to 01:00, so the day started at 03:00Z.
		expect(localDateAt(Date.UTC(2018, 10, 4, 2, 59, 59), tz)).toBe(
			"2018-11-03"
		);
		expect(localDateAt(Date.UTC(2018, 10, 4, 3), tz)).toBe("2018-11-04");
	});

	it("validates IANA time zones", () => {
		expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
		expect(isValidTimeZone("Not/A_Zone")).toBe(false);
	});
});
