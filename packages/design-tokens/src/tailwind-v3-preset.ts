import {
	fontFamily,
	nightColors,
	nightFonts,
	radius,
	spacing,
} from "./tokens.ts";

/**
 * Tailwind v3 preset for NativeWind v4 (mobile). Since 2.5.0 it carries the
 * same tokens as the web's v4 theme (`presets-parity.test.ts`): the `night`
 * set (`bg-night-surface`, `font-display`…), the only colors since 2.6.0.
 */
export const tailwindV3Preset = {
	theme: {
		extend: {
			colors: { night: nightColors },
			borderRadius: radius,
			spacing,
			fontFamily: { ...fontFamily, display: nightFonts.display },
		},
	},
};

export default tailwindV3Preset;
