// Schedule types added in 2.2.0: interval, monthly_days, once, yearly, plus
// occurrences, date rules and unsupported schedules.
import type { Schedule, StoredSchedule } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { eachDay } from "./dates.ts";
import {
	checkHabitDates,
	earliestStartDate,
	isHabitCountedOn,
	isHabitPossibleOn,
	matchesSchedule,
	MAX_LOOKAHEAD_DAYS,
	nextOccurrence,
	occurrencesBetween,
	type SchedulableHabit,
} from "./schedule.ts";

const sp = { timeZone: "America/Sao_Paulo" };
const tokyo = { timeZone: "Asia/Tokyo" };

function habit(
	schedule: StoredSchedule,
	overrides: Partial<SchedulableHabit> = {}
): SchedulableHabit {
	return {
		schedule,
		start_date: "2024-01-01",
		archived_at: null,
		deleted_at: null,
		...overrides,
	};
}

function matching(schedule: Schedule, from: string, to: string): string[] {
	return eachDay(from, to).filter((date) => matchesSchedule(schedule, date));
}

describe("interval", () => {
	const every8 = {
		type: "interval",
		every: 8,
		anchor_date: "2026-10-22",
	} as const;

	it("starts on the anchor and repeats every N days", () => {
		expect(matching(every8, "2026-10-20", "2026-11-10")).toEqual([
			"2026-10-22",
			"2026-10-30",
			"2026-11-07",
		]);
	});

	it("crosses month and year boundaries", () => {
		const every10 = {
			type: "interval",
			every: 10,
			anchor_date: "2026-12-25",
		} as const;
		expect(matching(every10, "2026-12-20", "2027-01-20")).toEqual([
			"2026-12-25",
			"2027-01-04",
			"2027-01-14",
		]);
	});

	it("crosses February 29 without drifting", () => {
		const every2 = {
			type: "interval",
			every: 2,
			anchor_date: "2028-02-27",
		} as const;
		expect(matching(every2, "2028-02-26", "2028-03-04")).toEqual([
			"2028-02-27",
			"2028-02-29",
			"2028-03-02",
			"2028-03-04",
		]);
	});

	it("has nothing before a future anchor", () => {
		const future = habit(every8, { start_date: "2026-10-22" });
		expect(nextOccurrence(future, "2026-10-11", sp)).toBe("2026-10-22");
		expect(isHabitPossibleOn(future, "2026-10-14", sp)).toBe(false);
	});

	it("every 1 is every day", () => {
		const daily = { type: "interval", every: 1, anchor_date: "2026-01-01" };
		expect(
			matching(daily as Schedule, "2026-01-01", "2026-01-05")
		).toHaveLength(5);
	});
});

describe("monthly_days", () => {
	it("repeats on the chosen days of every month", () => {
		const day20 = { type: "monthly_days", days: [20] } as const;
		expect(
			matching({ ...day20, days: [20] }, "2026-10-01", "2026-12-31")
		).toEqual(["2026-10-20", "2026-11-20", "2026-12-20"]);
	});

	it("moves the 31st to the last day of shorter months", () => {
		const day31 = { type: "monthly_days", days: [31] } as const;
		expect(
			matching({ ...day31, days: [31] }, "2026-01-01", "2026-06-30")
		).toEqual([
			"2026-01-31",
			"2026-02-28",
			"2026-03-31",
			"2026-04-30",
			"2026-05-31",
			"2026-06-30",
		]);
	});

	it("moves the 30th to February 28 or 29", () => {
		const day30: Schedule = { type: "monthly_days", days: [30] };
		expect(matching(day30, "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
		expect(matching(day30, "2028-02-01", "2028-02-29")).toEqual(["2028-02-29"]);
	});

	it("happens once when two chosen days land on the same last day", () => {
		const twoDays: Schedule = { type: "monthly_days", days: [29, 30, 31] };
		expect(matching(twoDays, "2027-02-01", "2027-02-28")).toEqual([
			"2027-02-28",
		]);
		expect(matching(twoDays, "2027-04-01", "2027-04-30")).toEqual([
			"2027-04-29",
			"2027-04-30",
		]);
	});

	it("crosses the year boundary", () => {
		const days: Schedule = { type: "monthly_days", days: [1, 15] };
		expect(matching(days, "2026-12-10", "2027-01-20")).toEqual([
			"2026-12-15",
			"2027-01-01",
			"2027-01-15",
		]);
	});
});

describe("once", () => {
	const appointment: Schedule = { type: "once", date: "2026-11-20" };

	it("matches its date only", () => {
		expect(matching(appointment, "2026-11-01", "2026-12-31")).toEqual([
			"2026-11-20",
		]);
	});

	it("has a next occurrence until the date passes", () => {
		const h = habit(appointment, { start_date: "2026-11-20" });
		expect(nextOccurrence(h, "2026-10-11", sp)).toBe("2026-11-20");
		expect(nextOccurrence(h, "2026-11-20", sp)).toBe("2026-11-20");
		expect(nextOccurrence(h, "2026-11-21", sp)).toBeNull();
	});
});

describe("yearly", () => {
	it("repeats every year on the same day", () => {
		const birthday: Schedule = { type: "yearly", month: 11, day: 20 };
		expect(matching(birthday, "2026-01-01", "2028-12-31")).toEqual([
			"2026-11-20",
			"2027-11-20",
			"2028-11-20",
		]);
	});

	it("falls on February 28 when February 29 does not exist", () => {
		const leapDay: Schedule = { type: "yearly", month: 2, day: 29 };
		expect(matching(leapDay, "2027-01-01", "2028-12-31")).toEqual([
			"2027-02-28",
			"2028-02-29",
		]);
	});

	it("does not also fall on February 28 in leap years", () => {
		const feb28: Schedule = { type: "yearly", month: 2, day: 28 };
		expect(matching(feb28, "2028-02-27", "2028-03-01")).toEqual(["2028-02-28"]);
	});
});

describe("unsupported schedules", () => {
	const future = habit({ type: "lunar" });

	it("never match and are never possible", () => {
		expect(matchesSchedule(future.schedule, "2026-10-11")).toBe(false);
		expect(isHabitPossibleOn(future, "2026-10-11", sp)).toBe(false);
		expect(nextOccurrence(future, "2026-10-11", sp)).toBeNull();
	});

	it("a malformed known type is unsupported too", () => {
		const broken = habit({ type: "interval", every: 0 });
		expect(isHabitPossibleOn(broken, "2026-10-11", sp)).toBe(false);
	});
});

describe("isHabitCountedOn", () => {
	const mondays = habit({ type: "weekdays", days: [1] });

	it("counts a completion on a day the schedule does not include", () => {
		expect(isHabitCountedOn(mondays, "2026-10-13", true, sp)).toBe(true);
		expect(isHabitCountedOn(mondays, "2026-10-13", false, sp)).toBe(false);
	});

	it("never counts deleted habits", () => {
		const deleted = { ...mondays, deleted_at: 1 };
		expect(isHabitCountedOn(deleted, "2026-10-12", true, sp)).toBe(false);
	});
});

describe("time zones", () => {
	it("archiving is a local date in the user's zone", () => {
		// 2026-11-20T01:00Z is still 2026-11-19 in São Paulo but already the
		// 20th in Tokyo; a habit archived during a day still counts on it.
		const h = habit(
			{ type: "once", date: "2026-11-20" },
			{ archived_at: Date.parse("2026-11-20T01:00:00Z") }
		);
		expect(isHabitPossibleOn(h, "2026-11-20", sp)).toBe(false);
		expect(isHabitPossibleOn(h, "2026-11-20", tokyo)).toBe(true);
	});
});

describe("occurrencesBetween", () => {
	const every3 = habit({
		type: "interval",
		every: 3,
		anchor_date: "2026-10-01",
	});

	it("lists dates in the range, start and archive included", () => {
		expect(occurrencesBetween(every3, "2026-10-01", "2026-10-10", sp)).toEqual([
			"2026-10-01",
			"2026-10-04",
			"2026-10-07",
			"2026-10-10",
		]);
	});

	it("refuses ranges longer than a year", () => {
		expect(() =>
			occurrencesBetween(every3, "2026-01-01", "2027-01-03", sp)
		).toThrow(RangeError);
	});

	it("respects start_date", () => {
		const later = { ...every3, start_date: "2026-10-05" };
		expect(occurrencesBetween(later, "2026-10-01", "2026-10-10", sp)).toEqual([
			"2026-10-07",
			"2026-10-10",
		]);
	});
});

describe("nextOccurrence", () => {
	it("gives up after the look-ahead limit", () => {
		const far = habit(
			{ type: "once", date: "2028-01-01" },
			{ start_date: "2028-01-01" }
		);
		expect(MAX_LOOKAHEAD_DAYS).toBe(400);
		expect(nextOccurrence(far, "2026-10-11", sp)).toBeNull();
		expect(nextOccurrence(far, "2027-06-01", sp)).toBe("2028-01-01");
	});
});

describe("habit date rules", () => {
	const today = "2026-10-11";

	it("weekday habits keep the backfill window; others start today", () => {
		expect(earliestStartDate({ type: "weekdays", days: [1] }, today)).toBe(
			"2026-10-04"
		);
		expect(earliestStartDate({ type: "monthly_days", days: [20] }, today)).toBe(
			today
		);
		expect(
			earliestStartDate({ type: "once", date: today }, today, { offline: true })
		).toBe("2026-10-04");
	});

	it("refuses a single date in the past", () => {
		const yesterday = { type: "once", date: "2026-10-10" } as const;
		expect(
			checkHabitDates(
				{ schedule: yesterday, start_date: "2026-10-10" },
				earliestStartDate(yesterday, today)
			)
		).toBe("date_out_of_range");
		const tomorrow = { type: "once", date: "2026-10-12" } as const;
		expect(
			checkHabitDates(
				{ schedule: tomorrow, start_date: "2026-10-12" },
				earliestStartDate(tomorrow, today)
			)
		).toBeNull();
	});

	it("refuses a start in the past for the new schedules", () => {
		const every8 = { type: "interval", every: 8, anchor_date: today } as const;
		expect(
			checkHabitDates(
				{ schedule: every8, start_date: "2026-10-10" },
				earliestStartDate(every8, today)
			)
		).toBe("date_out_of_range");
		expect(
			checkHabitDates(
				{ schedule: every8, start_date: "2026-10-22" },
				earliestStartDate(every8, today)
			)
		).toBeNull();
	});

	it("refuses a single date before the habit start", () => {
		const once = { type: "once", date: "2026-10-15" } as const;
		expect(
			checkHabitDates({ schedule: once, start_date: "2026-10-20" }, today, {
				checkStart: false,
			})
		).toBe("date_before_start");
	});
});
