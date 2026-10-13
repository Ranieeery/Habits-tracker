// The mark (2.4.0): four heatmap squares climbing in intensity, the same
// geometry as the web's `Wordmark` (viewBox 20×20). Since 2.9.0 it is also the
// app icon, the splash and the web icons: `markSvg` builds each one from the
// tokens, and `scripts/generate-brand.ts` renders them to PNG.
import { nightColors } from "./tokens.ts";

/** Side of the mark's own coordinate space. */
export const MARK_VIEWBOX = 20;

/** One square of the mark: position and size in the 20×20 space. */
export interface MarkSquare {
	x: number;
	y: number;
	/** Heatmap level of its color (`nightColors.heat`). */
	level: 2 | 3 | 4 | 5;
}

export const MARK_SQUARE_SIZE = 9;
export const MARK_SQUARE_RADIUS = 2.5;

/** Top row brighter (4, 5), bottom row darker (2, 3), like the grid. */
export const MARK_SQUARES: readonly MarkSquare[] = [
	{ x: 0, y: 0, level: 4 },
	{ x: 11, y: 0, level: 5 },
	{ x: 0, y: 11, level: 2 },
	{ x: 11, y: 11, level: 3 },
];

export interface MarkSvgOptions {
	/** Canvas side in pixels. */
	size: number;
	/** Share of the canvas side the mark takes, centered (0 < scale <= 1). */
	scale: number;
	/** Canvas color (a token value); transparent when absent. */
	background?: string;
	/** Corner radius of the background, as a share of its side (0 = square). */
	backgroundRadius?: number;
	/** White squares only (Android monochrome and notification icons). */
	monochrome?: boolean;
}

const MONOCHROME = "#ffffff";

const round = (value: number) => Math.round(value * 1000) / 1000;

/** The mark as a standalone SVG document. */
export function markSvg({
	size,
	scale,
	background,
	backgroundRadius = 0,
	monochrome = false,
}: MarkSvgOptions): string {
	if (!(scale > 0 && scale <= 1)) {
		throw new RangeError(`scale must be in (0, 1]: ${scale}`);
	}
	const markSide = size * scale;
	const factor = round(markSide / MARK_VIEWBOX);
	const offset = round((size - markSide) / 2);
	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
	];
	if (background) {
		const radius = round(size * backgroundRadius);
		parts.push(
			`<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`
		);
	}
	parts.push(`<g transform="translate(${offset} ${offset}) scale(${factor})">`);
	for (const square of MARK_SQUARES) {
		const fill = monochrome ? MONOCHROME : nightColors.heat[square.level];
		parts.push(
			`<rect x="${square.x}" y="${square.y}" width="${MARK_SQUARE_SIZE}" height="${MARK_SQUARE_SIZE}" rx="${MARK_SQUARE_RADIUS}" fill="${fill}"/>`
		);
	}
	parts.push("</g></svg>");
	return parts.join("");
}

/** One image to render: where it goes and how it looks. */
export interface BrandAsset extends MarkSvgOptions {
	/** Path from the repository root. */
	path: string;
}

/**
 * Scales chosen for each platform's safe zone (the mark is a square, so its
 * side must stay within ~0.707 of a circular mask's diameter):
 * - Android adaptive icon: 108 dp canvas, 66 dp safe circle → side ≤ 0.43.
 * - Android 12+ splash: the image is cropped to a circle → side ≤ 0.7.
 * - Web maskable icon: safe circle of 80% → side ≤ 0.56.
 */
export const BRAND_ASSETS: readonly BrandAsset[] = [
	// Mobile (apps/mobile/app.json points at these names).
	{
		path: "apps/mobile/assets/images/icon.png",
		size: 1024,
		scale: 0.56,
		background: nightColors.bg,
	},
	{
		path: "apps/mobile/assets/images/android-icon-foreground.png",
		size: 1024,
		scale: 0.42,
	},
	{
		path: "apps/mobile/assets/images/android-icon-monochrome.png",
		size: 1024,
		scale: 0.42,
		monochrome: true,
	},
	{ path: "apps/mobile/assets/images/splash-icon.png", size: 1024, scale: 0.6 },
	{
		path: "apps/mobile/assets/images/notification-icon.png",
		size: 96,
		scale: 0.8,
		monochrome: true,
	},
	{
		path: "apps/mobile/assets/images/favicon.png",
		size: 48,
		scale: 0.7,
		background: nightColors.bg,
		backgroundRadius: 0.22,
	},
	// Web (apps/web/public; index.html and the manifest point at these).
	{
		path: "apps/web/public/favicon-32x32.png",
		size: 32,
		scale: 0.7,
		background: nightColors.bg,
		backgroundRadius: 0.22,
	},
	{
		path: "apps/web/public/apple-touch-icon.png",
		size: 180,
		scale: 0.56,
		background: nightColors.bg,
	},
	{
		path: "apps/web/public/android-chrome-192x192.png",
		size: 192,
		scale: 0.6,
		background: nightColors.bg,
		backgroundRadius: 0.22,
	},
	{
		path: "apps/web/public/android-chrome-512x512.png",
		size: 512,
		scale: 0.6,
		background: nightColors.bg,
		backgroundRadius: 0.22,
	},
	{
		path: "apps/web/public/maskable-512x512.png",
		size: 512,
		scale: 0.5,
		background: nightColors.bg,
	},
];

/** `favicon.ico`: these sizes, each rendered like `favicon-32x32.png`. */
export const FAVICON_ICO = {
	path: "apps/web/public/favicon.ico",
	sizes: [16, 32, 48],
	scale: 0.7,
	background: nightColors.bg,
	backgroundRadius: 0.22,
} as const;

/**
 * Packs PNG images into one ICO file (PNG-compressed entries, supported by
 * every current browser). `images` are `[side, pngBytes]`, side ≤ 256.
 */
export function packIco(images: readonly [number, Uint8Array][]): Uint8Array {
	const headerSize = 6 + 16 * images.length;
	const total =
		headerSize + images.reduce((sum, [, png]) => sum + png.length, 0);
	const bytes = new Uint8Array(total);
	const view = new DataView(bytes.buffer);
	view.setUint16(0, 0, true); // reserved
	view.setUint16(2, 1, true); // type: icon
	view.setUint16(4, images.length, true);
	let offset = headerSize;
	images.forEach(([side, png], index) => {
		if (side < 1 || side > 256) throw new RangeError(`ICO side: ${side}`);
		const entry = 6 + 16 * index;
		view.setUint8(entry, side === 256 ? 0 : side); // width
		view.setUint8(entry + 1, side === 256 ? 0 : side); // height
		view.setUint8(entry + 2, 0); // palette size
		view.setUint8(entry + 3, 0); // reserved
		view.setUint16(entry + 4, 1, true); // color planes
		view.setUint16(entry + 6, 32, true); // bits per pixel
		view.setUint32(entry + 8, png.length, true);
		view.setUint32(entry + 12, offset, true);
		bytes.set(png, offset);
		offset += png.length;
	});
	return bytes;
}
