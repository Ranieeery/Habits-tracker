import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

/** Never leave the app stuck behind the splash. */
const MAX_SPLASH_MS = 10_000;

let hidden = false;

/** Keeps the native splash up until the first screen has something to show. */
export function keepSplashVisible() {
	SplashScreen.setOptions({ fade: true, duration: 200 });
	void SplashScreen.preventAutoHideAsync();
	setTimeout(hideSplash, MAX_SPLASH_MS);
}

export function hideSplash() {
	if (hidden) return;
	hidden = true;
	SplashScreen.hide();
}

/** Hides the splash once `ready` (no white flash, no half-loaded screen). */
export function useHideSplashWhen(ready: boolean) {
	useEffect(() => {
		if (ready) hideSplash();
	}, [ready]);
}
