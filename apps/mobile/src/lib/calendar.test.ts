import { describe, expect, it } from "vitest";
import { stepHour, withMinutes } from "./calendar.ts";

describe("reminder time steps", () => {
	it("moves the hour around midnight and sets 15-minute steps", () => {
		expect(stepHour("23:45", 1)).toBe("00:45");
		expect(stepHour("00:15", -1)).toBe("23:15");
		expect(withMinutes("20:00", "30")).toBe("20:30");
	});
});
