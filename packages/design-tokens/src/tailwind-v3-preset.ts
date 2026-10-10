import { colors, fontFamily, radius, spacing } from "./tokens.ts";

/** Tailwind v3 preset for NativeWind v4 (mobile). */
export const tailwindV3Preset = {
	theme: {
		extend: {
			colors,
			borderRadius: radius,
			spacing,
			fontFamily,
		},
	},
};

export default tailwindV3Preset;
