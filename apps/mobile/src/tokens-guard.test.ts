// Since 2.6.0 the whole mobile uses only the `night` design tokens
// (DESIGN.md), like the web (apps/web/src/tokens-guard.test.ts); the older
// palette no longer exists in the preset, so an old class would silently
// render nothing. This keeps old names from coming back.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(
	["./**/*.{ts,tsx}", "!./**/*.test.ts", "!./testing/**"],
	{ query: "?raw", import: "default", eager: true }
);

/** Utilities followed by an old color token: `bg-surface`, `text-muted`… */
const OLD_CLASS =
	/\b(?:bg|text|border|ring|tint|fill|stroke|divide|placeholder|decoration)-(?:background|surface|border|track|foreground|muted|accent(?:-hover)?|violet-\d{3}|heatmap-\d(?:-border)?|success(?:-hover)?|danger(?:-surface)?|warning(?:-surface)?)\b/g;
/** The removed `colors` export (`colors.muted`, `colors.violet[600]`…). */
const OLD_OBJECT = /(?<![\w.])colors\.(?!night)\w+/g;

describe("design tokens in the mobile app", () => {
	it("finds the sources", () => {
		expect(Object.keys(sources).length).toBeGreaterThan(60);
	});

	it("uses only the night set", () => {
		const found = Object.entries(sources).flatMap(([file, text]) =>
			[...text.matchAll(OLD_CLASS), ...text.matchAll(OLD_OBJECT)].map(
				(match) => `${file}: ${match[0]}`
			)
		);
		expect(found).toEqual([]);
	});

	it("would catch an old class or color", () => {
		expect("bg-surface text-night-muted".match(OLD_CLASS)).toEqual([
			"bg-surface",
		]);
		expect("color={colors.muted} nightColors.muted".match(OLD_OBJECT)).toEqual([
			"colors.muted",
		]);
	});
});
