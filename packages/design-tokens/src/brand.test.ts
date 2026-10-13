import { describe, expect, it } from "vitest";
import {
	BRAND_ASSETS,
	MARK_SQUARE_SIZE,
	MARK_SQUARES,
	MARK_VIEWBOX,
	markSvg,
	packIco,
} from "./brand.ts";
import { nightColors } from "./tokens.ts";

const fills = (svg: string) =>
	[...svg.matchAll(/fill="([^"]+)"/g)].map((match) => match[1]);

describe("markSvg", () => {
	it("draws the four squares in the heatmap colors, brightest on top", () => {
		const svg = markSvg({ size: 100, scale: 1 });
		expect(fills(svg)).toEqual([
			nightColors.heat[4],
			nightColors.heat[5],
			nightColors.heat[2],
			nightColors.heat[3],
		]);
		expect(svg).toContain('width="100" height="100"');
	});

	it("fills the canvas with a token and centers the scaled mark", () => {
		const svg = markSvg({ size: 1000, scale: 0.5, background: nightColors.bg });
		expect(fills(svg)[0]).toBe(nightColors.bg);
		expect(svg).toContain('transform="translate(250 250) scale(25)"');
	});

	it("is white only when monochrome", () => {
		const svg = markSvg({ size: 96, scale: 0.8, monochrome: true });
		expect(new Set(fills(svg))).toEqual(new Set(["#ffffff"]));
	});

	it("refuses a scale outside (0, 1]", () => {
		expect(() => markSvg({ size: 10, scale: 0 })).toThrow(RangeError);
		expect(() => markSvg({ size: 10, scale: 1.2 })).toThrow(RangeError);
	});

	it("keeps the squares inside the 20×20 space", () => {
		for (const { x, y } of MARK_SQUARES) {
			expect(x + MARK_SQUARE_SIZE).toBeLessThanOrEqual(MARK_VIEWBOX);
			expect(y + MARK_SQUARE_SIZE).toBeLessThanOrEqual(MARK_VIEWBOX);
		}
	});
});

describe("BRAND_ASSETS", () => {
	const byName = (name: string) => {
		const asset = BRAND_ASSETS.find((item) => item.path.endsWith(name));
		if (!asset) throw new Error(name);
		return asset;
	};
	// The mark is a square: inside a circle of diameter d its side is at most
	// d / √2.
	const fitsCircle = (scale: number, diameter: number) =>
		scale <= diameter / Math.SQRT2;

	it("keeps the mark inside each platform's round mask", () => {
		// Android adaptive icon: 66 dp safe circle on a 108 dp canvas.
		expect(
			fitsCircle(byName("android-icon-foreground.png").scale, 66 / 108)
		).toBe(true);
		expect(
			fitsCircle(byName("android-icon-monochrome.png").scale, 66 / 108)
		).toBe(true);
		// Android 12+ splash: the image is cropped to a circle.
		expect(fitsCircle(byName("splash-icon.png").scale, 1)).toBe(true);
		// Web maskable icon: 80% safe circle.
		expect(fitsCircle(byName("maskable-512x512.png").scale, 0.8)).toBe(true);
	});

	it("gives opaque icons where the platform needs them", () => {
		expect(byName("icon.png").background).toBe(nightColors.bg);
		expect(byName("apple-touch-icon.png").background).toBe(nightColors.bg);
		expect(byName("maskable-512x512.png").background).toBe(nightColors.bg);
		expect(byName("android-icon-foreground.png").background).toBeUndefined();
	});

	it("draws the monochrome icons in white only", () => {
		for (const name of [
			"android-icon-monochrome.png",
			"notification-icon.png",
		]) {
			expect(byName(name).monochrome).toBe(true);
			expect(byName(name).background).toBeUndefined();
		}
	});
});

describe("packIco", () => {
	it("writes the ICO header and one PNG entry per size", () => {
		const a = new Uint8Array([1, 2, 3]);
		const b = new Uint8Array([4, 5]);
		const ico = packIco([
			[16, a],
			[256, b],
		]);
		const view = new DataView(ico.buffer);
		expect(view.getUint16(2, true)).toBe(1); // icon
		expect(view.getUint16(4, true)).toBe(2); // two images
		expect(ico[6]).toBe(16); // first width
		expect(ico[6 + 16]).toBe(0); // 256 is written as 0
		const firstOffset = view.getUint32(6 + 12, true);
		expect(firstOffset).toBe(6 + 32);
		expect([...ico.slice(firstOffset, firstOffset + 3)]).toEqual([1, 2, 3]);
		expect([...ico.slice(-2)]).toEqual([4, 5]);
	});
});
