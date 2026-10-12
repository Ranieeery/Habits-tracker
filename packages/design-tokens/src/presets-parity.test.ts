import { describe, expect, it } from "vitest";
import { tailwindV3Preset } from "./tailwind-v3-preset.ts";
import { renderThemeCss } from "./theme-css.ts";
import { colors, HEATMAP_LEVELS, nightColors } from "./tokens.ts";

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

describe("Tailwind v3 preset and v4 theme", () => {
	it("expose the same shared tokens with the same values", () => {
		const v4 = v4Vars();
		for (const [name, value] of v3Vars()) {
			expect(v4.get(name), name).toBe(value);
		}
	});

	it("add only the web-only night set to the v4 theme", () => {
		const v3 = v3Vars();
		const extra = [...v4Vars().keys()].filter((name) => !v3.has(name));
		expect(extra.sort()).toEqual(
			[
				...flatten(nightColors, "--color-night").map(([name]) => name),
				"--font-display",
			].sort()
		);
	});

	it("define every heatmap level with a border", () => {
		const levels = Array.from({ length: HEATMAP_LEVELS }, (_, i) => i);
		expect(Object.keys(colors.heatmap).sort()).toEqual(
			levels.flatMap((i) => [`${i}`, `${i}-border`]).sort()
		);
	});

	it("use lowercase 6-digit hex for every color", () => {
		for (const [name, value] of [
			...flatten(colors, "--color"),
			...flatten(nightColors, "--color-night"),
		]) {
			expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
