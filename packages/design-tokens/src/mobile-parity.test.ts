// The mobile (NativeWind preset and the token exports it imports) must not
// change during the web-only redesign stages. The fixture is the 2.3.0
// output, recorded before the `night` set was added; re-record it on
// purpose, in a visible diff, only in the mobile redesign stage.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/mobile-v2.3.0.json" with { type: "json" };
import { tailwindV3Preset } from "./tailwind-v3-preset.ts";
import {
	colors,
	fontFamily,
	HEATMAP_LEVELS,
	radius,
	spacing,
	TOUCH_TARGET_MIN,
} from "./tokens.ts";

describe("mobile tokens", () => {
	it("keep the Tailwind v3 preset identical to 2.3.0", () => {
		expect(tailwindV3Preset).toEqual(fixture.tailwindV3Preset);
	});

	it("keep the exports the mobile imports identical to 2.3.0", () => {
		expect({
			colors,
			radius,
			spacing,
			fontFamily,
			HEATMAP_LEVELS,
			TOUCH_TARGET_MIN,
		}).toEqual({
			colors: fixture.colors,
			radius: fixture.radius,
			spacing: fixture.spacing,
			fontFamily: fixture.fontFamily,
			HEATMAP_LEVELS: fixture.HEATMAP_LEVELS,
			TOUCH_TARGET_MIN: fixture.TOUCH_TARGET_MIN,
		});
	});
});
