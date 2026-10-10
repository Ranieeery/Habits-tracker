import { describe, expect, it } from "vitest";
import { tailwindV3Preset } from "./tailwind-v3-preset.ts";
import { renderThemeCss } from "./theme-css.ts";
import { colors, HEATMAP_LEVELS } from "./tokens.ts";

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
	for (const match of renderThemeCss().matchAll(/^\t(--[\w-]+): (.+);$/gm)) {
		const [, name, value] = match;
		// Font stacks are quoted in CSS; compare the bare family names.
		vars.set(name!, value!.replaceAll('"', "").replaceAll(", ", ","));
	}
	return vars;
}

describe("Tailwind v3 preset and v4 theme", () => {
	it("expose the same tokens with the same values", () => {
		expect(Object.fromEntries(v4Vars())).toEqual(Object.fromEntries(v3Vars()));
	});

	it("define every heatmap level with a border", () => {
		const levels = Array.from({ length: HEATMAP_LEVELS }, (_, i) => i);
		expect(Object.keys(colors.heatmap).sort()).toEqual(
			levels.flatMap((i) => [`${i}`, `${i}-border`]).sort()
		);
	});

	it("use lowercase 6-digit hex for every color", () => {
		for (const [name, value] of flatten(colors, "--color")) {
			expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
