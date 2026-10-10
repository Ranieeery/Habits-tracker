import { colors, fontFamily, radius } from "./tokens.ts";

/** Tailwind v3 preset for NativeWind v4 (mobile). */
export const tailwindV3Preset = {
	theme: {
		extend: {
			colors,
			borderRadius: radius,
			fontFamily,
		},
	},
};

export default tailwindV3Preset;
