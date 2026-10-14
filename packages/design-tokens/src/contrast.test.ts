// WCAG contrast of the pairs the apps draw (DESIGN.md: text >= 4.5:1, UI
// components >= 3:1). Since 2.5.0 the mobile screens not migrated yet read
// the night values through the deprecated aliases, so their pairs are here
// too: a palette change that makes one of them illegible fails this test.
import { describe, expect, it } from "vitest";
import { nightColors as n } from "./tokens.ts";

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
		number,
		number,
	];
	return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;

const surfaces = {
	bg: n.bg,
	surface: n.surface.DEFAULT,
	raised: n.surface.raised,
};

describe("contrast of the night pairs", () => {
	it.each(Object.entries(surfaces))("text on %s", (_, surface) => {
		for (const text of [n.foreground, n.muted, n.subtle, n.accent.text]) {
			expect(contrast(text, surface), text).toBeGreaterThanOrEqual(TEXT);
		}
		for (const state of [
			n.success.DEFAULT,
			n.danger.DEFAULT,
			n.warning.DEFAULT,
		]) {
			expect(contrast(state, surface), state).toBeGreaterThanOrEqual(TEXT);
		}
	});

	it("text and icons on the accent (primary button, chosen chip)", () => {
		expect(contrast(n.accent.on, n.accent.DEFAULT)).toBeGreaterThanOrEqual(
			TEXT
		);
	});

	it("the check icon on a checked box", () => {
		expect(contrast(n.bg, n.success.DEFAULT)).toBeGreaterThanOrEqual(TEXT);
	});

	it("state text on its own surface", () => {
		expect(
			contrast(n.success.DEFAULT, n.success.surface)
		).toBeGreaterThanOrEqual(TEXT);
		expect(contrast(n.danger.DEFAULT, n.danger.surface)).toBeGreaterThanOrEqual(
			TEXT
		);
		expect(
			contrast(n.warning.DEFAULT, n.warning.surface)
		).toBeGreaterThanOrEqual(TEXT);
	});

	// `border-strong` (empty cells, field outlines) is about 1.9:1: those are
	// always identified by a label or by the grid, never by the outline alone.
	it("UI components on the background", () => {
		for (const ui of [n.accent.DEFAULT, n.accent.text, n.foreground]) {
			expect(contrast(ui, n.bg), ui).toBeGreaterThanOrEqual(UI);
		}
	});

	// 2.14.0: the dashed outline of the heatmap's preview days is its only
	// shape (no fill), so it must reach 3:1 on the page and on the panels.
	it("the preview cells' dashed outline", () => {
		expect(contrast(n.subtle, n.bg)).toBeGreaterThanOrEqual(UI);
		expect(contrast(n.subtle, n.surface.DEFAULT)).toBeGreaterThanOrEqual(UI);
	});
});
