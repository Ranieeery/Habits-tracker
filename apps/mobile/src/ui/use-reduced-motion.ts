import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system's "remove animations" preference, kept up to date while the app
 * runs (Reanimated's `useReducedMotion` reads it once at launch). DESIGN.md:
 * with it on, nothing animates. Starts as `true` until the first answer, so
 * nothing animates for someone who asked for no motion.
 */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(true);
	useEffect(() => {
		let active = true;
		void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
			if (active) setReduced(value);
		});
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReduced
		);
		return () => {
			active = false;
			subscription.remove();
		};
	}, []);
	return reduced;
}
