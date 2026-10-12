import {
	colors,
	fontFamily,
	nightColors,
	nightFonts,
	radius,
	spacing,
} from "./tokens.ts";

/**
 * Tailwind v3 preset for NativeWind v4 (mobile). Since 2.5.0 it carries the
 * same tokens as the web's v4 theme (`presets-parity.test.ts`): the `night`
 * set (`bg-night-surface`, `font-display`…) plus the deprecated aliases.
 */
export const tailwindV3Preset = {
	theme: {
		extend: {
			colors: { ...colors, night: nightColors },
			borderRadius: radius,
			spacing,
			fontFamily: { ...fontFamily, display: nightFonts.display },
		},
	},
};

export default tailwindV3Preset;
