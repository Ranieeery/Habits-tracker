// Display face of the 2.5.0 identity (DESIGN.md "Mobile"): Bricolage
// Grotesque 600/700 as static TTFs in assets/fonts (SIL OFL 1.1, copied from
// @expo-google-fonts/bricolage-grotesque 0.4.1; ~182 KB). Loaded from JS with
// expo-font (already in the build), so it ships as an OTA update; the
// expo-font config plugin would embed it natively and need a new build. Text
// stays in the system font. Android picks a static file by family name, not
// by fontWeight, so each weight is its own family.
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";

export const displayFont = {
	semibold: "BricolageGrotesque_600SemiBold",
	bold: "BricolageGrotesque_700Bold",
} as const;

// Metro bundles assets through `require` (the pattern expo-font documents;
// the Expo types declare no `.ttf` module for an import).
/* eslint-disable @typescript-eslint/no-require-imports */
const sources = {
	[displayFont.semibold]: require("../../assets/fonts/BricolageGrotesque_600SemiBold.ttf"),
	[displayFont.bold]: require("../../assets/fonts/BricolageGrotesque_700Bold.ttf"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Local files load in milliseconds; never hold the splash longer. */
const MAX_FONT_WAIT_MS = 3000;

/**
 * True once the display fonts are ready, failed (the system font is used
 * instead) or took longer than the cap. The splash stays up until then, so
 * text never renders in one face and jumps to another.
 */
export function useDisplayFontsReady(): boolean {
	const [loaded, error] = useFonts(sources);
	const [timedOut, setTimedOut] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setTimedOut(true), MAX_FONT_WAIT_MS);
		return () => clearTimeout(timer);
	}, []);
	return loaded || error !== null || timedOut;
}
