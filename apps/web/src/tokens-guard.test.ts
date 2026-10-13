// Since 2.4.0 the web uses only the `night` design tokens (DESIGN.md); since
// 2.6.0 the older palette no longer exists in the theme at all, so an old
// class would silently render nothing. This keeps old names from coming back.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(
	["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}", "!./test/**"],
	{ query: "?raw", import: "default", eager: true }
);

/** Utilities followed by an old color token: `bg-surface`, `text-muted`… */
const OLD_TOKEN =
	/\b(?:bg|text|border|ring|inset-ring|outline|fill|stroke|from|via|to|shadow|divide|placeholder|decoration|caret|accent)-(?:background|surface|border|track|foreground|muted|accent(?:-hover)?|violet-\d{3}|heatmap-\d(?:-border)?|success(?:-hover)?|danger(?:-surface)?|warning(?:-surface)?)\b/g;

describe("design tokens in the web app", () => {
	it("finds the sources", () => {
		expect(Object.keys(sources).length).toBeGreaterThan(40);
	});

	it("uses only the night set", () => {
		const found = Object.entries(sources).flatMap(([file, text]) =>
			[...text.matchAll(OLD_TOKEN)].map((match) => `${file}: ${match[0]}`)
		);
		expect(found).toEqual([]);
	});

	it("would catch an old class", () => {
		expect("bg-surface text-night-muted".match(OLD_TOKEN)).toEqual([
			"bg-surface",
		]);
	});
});
