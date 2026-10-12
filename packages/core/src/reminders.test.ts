import { describe, expect, it } from "vitest";
import {
	isReminderDue,
	localTimeAt,
	reminderMessage,
	shouldSendReminder,
	type ShouldSendReminderInput,
} from "./reminders.ts";

const SP = "America/Sao_Paulo"; // UTC-3, no DST since 2019
const TOKYO = "Asia/Tokyo"; // UTC+9

/** An instant given as São Paulo wall-clock time. */
const sp = (date: string, time: string) =>
	Date.parse(`${date}T${time}:00-03:00`);

const base: ShouldSendReminderInput = {
	nowMs: sp("2026-10-10", "20:00"),
	timeZone: SP,
	reminderTime: "20:00",
	lastReminderDate: "2026-10-09",
	pendingCount: 2,
};

describe("localTimeAt", () => {
	it("reads the wall clock in the given zone", () => {
		const now = Date.parse("2026-10-10T23:30:00Z");
		expect(localTimeAt(now, SP)).toBe("20:30");
		expect(localTimeAt(now, TOKYO)).toBe("08:30");
		expect(localTimeAt(now, "UTC")).toBe("23:30");
	});

	it("prints midnight as 00:00", () => {
		expect(localTimeAt(sp("2026-10-11", "00:00"), SP)).toBe("00:00");
		expect(localTimeAt(sp("2026-10-11", "00:05"), SP)).toBe("00:05");
	});
});

describe("shouldSendReminder", () => {
	it("waits for the reminder time, then sends within the grace window", () => {
		expect(
			shouldSendReminder({ ...base, nowMs: sp("2026-10-10", "19:59") })
		).toBe(false);
		expect(shouldSendReminder(base)).toBe(true);
		expect(
			shouldSendReminder({ ...base, nowMs: sp("2026-10-10", "20:59") })
		).toBe(true);
		// REMINDER_GRACE_MINUTES (60) later, it is too late for today.
		expect(
			shouldSendReminder({ ...base, nowMs: sp("2026-10-10", "21:00") })
		).toBe(false);
	});

	it("never sends after the day turns, even inside the window", () => {
		const late = { ...base, reminderTime: "23:45" };
		expect(
			shouldSendReminder({ ...late, nowMs: sp("2026-10-10", "23:45") })
		).toBe(true);
		expect(
			shouldSendReminder({ ...late, nowMs: sp("2026-10-11", "00:15") })
		).toBe(false);
	});

	it("rounds an off-step time down to the 15-minute step", () => {
		const offStep = { ...base, reminderTime: "20:07" };
		expect(
			shouldSendReminder({ ...offStep, nowMs: sp("2026-10-10", "20:00") })
		).toBe(true);
	});

	it("needs pending habits (none possible today, or all done)", () => {
		expect(shouldSendReminder({ ...base, pendingCount: 0 })).toBe(false);
	});

	it("never sends when reminders are off", () => {
		expect(shouldSendReminder({ ...base, reminderTime: null })).toBe(false);
	});

	it("sends at most once per local day", () => {
		expect(
			shouldSendReminder({ ...base, lastReminderDate: "2026-10-10" })
		).toBe(false);
		expect(shouldSendReminder({ ...base, lastReminderDate: null })).toBe(true);
	});

	it("uses the user's zone, not UTC", () => {
		// 2026-10-10T23:30Z: 20:30 in São Paulo, 08:30 next day in Tokyo.
		const now = Date.parse("2026-10-10T23:30:00Z");
		expect(shouldSendReminder({ ...base, nowMs: now })).toBe(true);
		expect(
			shouldSendReminder({
				...base,
				nowMs: now,
				timeZone: TOKYO,
				lastReminderDate: "2026-10-10",
			})
		).toBe(false); // 08:30 on 2026-10-11 in Tokyo: before 20:00
		expect(
			shouldSendReminder({
				...base,
				nowMs: now,
				timeZone: TOKYO,
				reminderTime: "08:00",
				lastReminderDate: "2026-10-10",
			})
		).toBe(true); // a new day in Tokyo, after 08:00
	});

	it("starts over after the day turns", () => {
		const justAfterMidnight = sp("2026-10-11", "00:10");
		expect(
			shouldSendReminder({
				...base,
				nowMs: justAfterMidnight,
				lastReminderDate: "2026-10-10",
			})
		).toBe(false); // new day, but before 20:00
		expect(
			shouldSendReminder({
				...base,
				nowMs: sp("2026-10-11", "20:00"),
				lastReminderDate: "2026-10-10",
			})
		).toBe(true);
	});

	it("crosses the year boundary", () => {
		expect(
			shouldSendReminder({
				...base,
				nowMs: sp("2027-01-01", "20:15"),
				lastReminderDate: "2026-12-31",
			})
		).toBe(true);
		// 2027-01-01T01:00Z is still 2026-12-31 22:00 in São Paulo.
		expect(
			shouldSendReminder({
				...base,
				nowMs: Date.parse("2027-01-01T01:00:00Z"),
				lastReminderDate: "2026-12-31",
			})
		).toBe(false);
	});
});

describe("isReminderDue", () => {
	it("returns the user's today with the decision", () => {
		expect(
			isReminderDue({ ...base, nowMs: Date.parse("2026-12-31T23:30:00Z") })
		).toEqual({ due: true, today: "2026-12-31" });
	});
});

describe("reminderMessage", () => {
	it("counts habits in pt-BR without naming them", () => {
		expect(reminderMessage(1)).toEqual({
			title: "Habits",
			body: "Você tem 1 hábito pendente hoje.",
		});
		expect(reminderMessage(3).body).toBe("Você tem 3 hábitos pendentes hoje.");
	});
});
