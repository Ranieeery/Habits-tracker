import { nightColors } from "@habits/design-tokens";
import { describe, expect, it } from "vitest";
import { withAlpha } from "./color.ts";

describe("withAlpha", () => {
	it("turns a token into rgba with the given alpha", () => {
		expect(withAlpha("#7c49e3", 0.3)).toBe("rgba(124, 73, 227, 0.3)");
		expect(withAlpha(nightColors.bg, 1)).toBe("rgba(10, 9, 17, 1)");
	});

	it("clamps the alpha to [0, 1]", () => {
		expect(withAlpha("#ffffff", 2)).toBe("rgba(255, 255, 255, 1)");
		expect(withAlpha("#ffffff", -1)).toBe("rgba(255, 255, 255, 0)");
	});

	it("rejects anything but a 6-digit hex", () => {
		expect(() => withAlpha("#fff", 0.5)).toThrow();
		expect(() => withAlpha("violet", 0.5)).toThrow();
	});
});
