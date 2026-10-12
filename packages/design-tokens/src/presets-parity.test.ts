import { describe, expect, it } from "vitest";
import { tailwindV3Preset } from "./tailwind-v3-preset.ts";
import { renderThemeCss } from "./theme-css.ts";
import { colors, HEATMAP_LEVELS, nightColors, nightFonts } from "./tokens.ts";

type Tree = { readonly [key: string]: string | readonly string[] | Tree };

// Flattens a Tailwind v3 theme section the way Tailwind v4 names CSS vars.
function flatten(tree: Tree, prefix: string): [string, string][] {
	return Object.entries(tree).flatMap(([key, value]) => {
		const name = key === "DEFAULT" ? prefix : `${prefix}-${key}`;
		if (typeof value === "string") return [[name, value] as [string, string]];
		if (Array.isArray(value)) return [[name, value.join(",")]];
		return flatten(value as Tree, name);
	});
}

function v3Vars(): Map<string, string> {
	const { colors, borderRadius, spacing, fontFamily } =
		tailwindV3Preset.theme.extend;
	return new Map([
		...flatten(colors, "--color"),
		...flatten(borderRadius, "--radius"),
		...flatten(spacing, "--spacing"),
		...flatten(fontFamily, "--font"),
	]);
}

function v4Vars(): Map<string, string> {
	const vars = new Map<string, string>();
	for (const match of renderThemeCss().matchAll(/^\t(--[\w-]+):\s+(.+);$/gm)) {
		// `\s+` also takes the line break Prettier puts in long declarations.
		const [, name, value] = match;
		// Font stacks are quoted in CSS; compare the bare family names.
		vars.set(name!, value!.replaceAll('"', "").replaceAll(", ", ","));
	}
	return vars;
}

// Since 2.5.0 the mobile uses the same identity as the web: both outputs
// must expose exactly the same tokens with the same values, in both
// directions (a token only one side has would be a drift).
describe("Tailwind v3 preset and v4 theme", () => {
	it("expose exactly the same tokens with the same values", () => {
		const v3 = Object.fromEntries(v3Vars());
		const v4 = Object.fromEntries(v4Vars());
		expect(v3).toEqual(v4);
	});

	it("include the night set and the display font", () => {
		const v3 = v3Vars();
		for (const [name, value] of flatten(nightColors, "--color-night")) {
			expect(v3.get(name), name).toBe(value);
		}
		expect(v3.get("--font-display")).toBe(nightFonts.display.join(","));
	});

	it("point every deprecated alias at a night value", () => {
		const night = new Set(
			flatten(nightColors, "--color-night").map(([, value]) => value)
		);
		for (const [name, value] of flatten(colors, "--color")) {
			expect(night.has(value), name).toBe(true);
		}
	});

	it("define one night color per heatmap level", () => {
		expect(Object.keys(nightColors.heat)).toHaveLength(HEATMAP_LEVELS);
	});

	it("use lowercase 6-digit hex for every color", () => {
		for (const [name, value] of flatten(nightColors, "--color-night")) {
			expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
