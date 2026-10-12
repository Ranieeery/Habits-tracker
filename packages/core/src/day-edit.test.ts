import { describe, expect, it } from "vitest";
import { addDays } from "./dates.ts";
import { getDayEditState, isDayEditable } from "./day-edit.ts";
import { BACKFILL_DAYS, isWithinWriteWindow, todayIn } from "./window.ts";

describe("getDayEditState", () => {
	const today = "2026-10-09";

	it.each([
		["today", today, "today"],
		["yesterday", "2026-10-08", "past_editable"],
		["exactly 30 days ago", "2026-09-09", "past_editable"],
		["31 days ago", "2026-09-08", "past_locked"],
		["tomorrow", "2026-10-10", "future"],
		["next year", "2027-01-01", "future"],
	])("%s (%s) is %s", (_, date, state) => {
		expect(getDayEditState(date, today)).toBe(state);
	});

	it("crosses month and year boundaries", () => {
		expect(getDayEditState("2025-12-04", "2026-01-03")).toBe("past_editable");
		expect(getDayEditState("2025-12-03", "2026-01-03")).toBe("past_locked");
		expect(getDayEditState("2024-02-01", "2024-03-02")).toBe("past_editable");
	});

	it("takes the window size as a parameter", () => {
		expect(getDayEditState("2026-10-02", today, 7)).toBe("past_editable");
		expect(getDayEditState("2026-10-01", today, 7)).toBe("past_locked");
	});

	it("follows the user's time zone at midnight", () => {
		// 2026-10-10 02:59:59 UTC is 23:59:59 of 2026-10-09 in São Paulo.
		const before = Date.UTC(2026, 9, 10, 2, 59, 59);
		const after = before + 1000;
		const sp = "America/Sao_Paulo";
		expect(getDayEditState("2026-09-09", todayIn(sp, before))).toBe(
			"past_editable"
		);
		expect(getDayEditState("2026-09-09", todayIn(sp, after))).toBe(
			"past_locked"
		);
		expect(getDayEditState("2026-10-09", todayIn(sp, before))).toBe("today");
		expect(getDayEditState("2026-10-09", todayIn(sp, after))).toBe(
			"past_editable"
		);
	});

	it("gives different answers in different zones at the same instant", () => {
		// 2026-01-01T02:00Z: 2025-12-31 in São Paulo, 2026-01-01 in UTC and Tokyo.
		const now = Date.UTC(2026, 0, 1, 2);
		expect(
			getDayEditState("2026-01-01", todayIn("America/Sao_Paulo", now))
		).toBe("future");
		expect(getDayEditState("2026-01-01", todayIn("UTC", now))).toBe("today");
		expect(
			getDayEditState("2025-12-01", todayIn("America/Sao_Paulo", now))
		).toBe("past_editable");
		expect(getDayEditState("2025-12-01", todayIn("Asia/Tokyo", now))).toBe(
			"past_locked"
		);
	});

	it("never offers a day the server would refuse", () => {
		for (let offset = -40; offset <= 3; offset += 1) {
			const date = addDays(today, offset);
			const state = getDayEditState(date, today);
			if (state === "today" || state === "past_editable") {
				expect(isWithinWriteWindow(date, today)).toBe(true);
			}
			if (state === "past_locked") {
				expect(isWithinWriteWindow(date, today)).toBe(false);
			}
		}
		expect(getDayEditState(addDays(today, -BACKFILL_DAYS), today)).toBe(
			"past_editable"
		);
	});
});

describe("isDayEditable", () => {
	it("needs an unlock only for past days in the window", () => {
		expect(isDayEditable("today", false)).toBe(true);
		expect(isDayEditable("past_editable", false)).toBe(false);
		expect(isDayEditable("past_editable", true)).toBe(true);
		expect(isDayEditable("past_locked", true)).toBe(false);
		expect(isDayEditable("future", true)).toBe(false);
	});
});
