import { describe, expect, it } from "vitest";
import { uuidV7 } from "./ids.ts";

describe("uuidV7", () => {
	it("puts the instant first and sets the version and variant", () => {
		const id = uuidV7(Date.UTC(2026, 9, 9), new Uint8Array(16).fill(0xff));
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16)).toBe(
			Date.UTC(2026, 9, 9)
		);
	});

	it("sorts by time", () => {
		const random = new Uint8Array(16);
		expect(uuidV7(1000, random) < uuidV7(1001, random)).toBe(true);
	});

	it("needs 16 random bytes", () => {
		expect(() => uuidV7(1, new Uint8Array(8))).toThrow(RangeError);
	});
});
