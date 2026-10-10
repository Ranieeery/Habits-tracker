import { describe, expect, it } from "vitest";
import { eachDay } from "./dates.ts";
import {
	isHabitPossibleOn,
	matchesSchedule,
	type SchedulableHabit,
} from "./schedule.ts";

const everyDay = { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] } as const;
const sp = { timeZone: "America/Sao_Paulo" };

function habit(overrides: Partial<SchedulableHabit> = {}): SchedulableHabit {
	return {
		schedule: { type: "weekdays", days: [...everyDay.days] },
		start_date: "2026-01-01",
		archived_at: null,
		deleted_at: null,
		...overrides,
	};
}

describe("matchesSchedule", () => {
	it("matches the chosen weekdays only", () => {
		const mondayWednesday = { type: "weekdays", days: [1, 3] } as const;
		const week = eachDay("2026-01-04", "2026-01-10"); // Sunday..Saturday
		expect(
			week.filter((date) =>
				matchesSchedule(
					{ ...mondayWednesday, days: [...mondayWednesday.days] },
					date
				)
			)
		).toEqual(["2026-01-05", "2026-01-07"]);
	});
});

describe("isHabitPossibleOn", () => {
	it("starts counting on start_date for a habit created mid-week", () => {
		// 2026-01-07 is a Wednesday.
		const created = habit({ start_date: "2026-01-07" });
		const week = eachDay("2026-01-04", "2026-01-10");
		expect(week.filter((date) => isHabitPossibleOn(created, date, sp))).toEqual(
			["2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"]
		);
	});

	it("keeps the archive day possible and drops the days after it", () => {
		// 2026-01-10T01:00Z is 2026-01-09 22:00 in São Paulo.
		const archived = habit({ archived_at: Date.UTC(2026, 0, 10, 1) });
		expect(isHabitPossibleOn(archived, "2026-01-09", sp)).toBe(true);
		expect(isHabitPossibleOn(archived, "2026-01-10", sp)).toBe(false);
	});

	it("derives the archive day from the user's time zone", () => {
		const archived = habit({ archived_at: Date.UTC(2026, 0, 10, 1) });
		// Same instant is already 2026-01-10 10:00 in Tokyo.
		expect(
			isHabitPossibleOn(archived, "2026-01-10", { timeZone: "Asia/Tokyo" })
		).toBe(true);
		expect(isHabitPossibleOn(archived, "2026-01-10", sp)).toBe(false);
	});

	it("is never possible once deleted", () => {
		expect(isHabitPossibleOn(habit({ deleted_at: 1 }), "2026-01-05", sp)).toBe(
			false
		);
	});

	it("crosses the year boundary using the weekday of each date", () => {
		const sundays = habit({
			schedule: { type: "weekdays", days: [0] },
			start_date: "2025-12-01",
		});
		expect(
			eachDay("2025-12-25", "2026-01-10").filter((date) =>
				isHabitPossibleOn(sundays, date, sp)
			)
		).toEqual(["2025-12-28", "2026-01-04"]);
	});

	it("handles Feb 29 in a leap year", () => {
		const thursdays = habit({
			schedule: { type: "weekdays", days: [4] },
			start_date: "2024-01-01",
		});
		expect(isHabitPossibleOn(thursdays, "2024-02-29", sp)).toBe(true);
	});
});
