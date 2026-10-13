// Renders the mark (src/brand.ts) to the app icons, the splash and the web
// icons. The PNGs are committed: run this only after changing the mark or the
// tokens it uses (`pnpm --filter @habits/design-tokens brand`).
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import {
	BRAND_ASSETS,
	FAVICON_ICO,
	markSvg,
	type MarkSvgOptions,
	packIco,
} from "../src/brand.ts";

const root = new URL("../../../", import.meta.url);

async function render(options: MarkSvgOptions): Promise<Uint8Array> {
	// The SVG is drawn at its own pixel size: no resampling.
	return sharp(Buffer.from(markSvg(options)))
		.png({ compressionLevel: 9 })
		.toBuffer();
}

for (const { path, ...options } of BRAND_ASSETS) {
	writeFileSync(new URL(path, root), await render(options));
	console.log(`Wrote ${path}`);
}

const { path, sizes, ...icoOptions } = FAVICON_ICO;
const images: [number, Uint8Array][] = [];
for (const size of sizes) {
	images.push([size, await render({ ...icoOptions, size })]);
}
writeFileSync(new URL(path, root), packIco(images));
console.log(`Wrote ${path}`);
