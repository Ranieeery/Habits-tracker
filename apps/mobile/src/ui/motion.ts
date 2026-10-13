// The two feedback motions of DESIGN.md "Movimento", shared by the "Hoje"
// panel and today's heatmap cell (the web's `pulse`/`release` in
// features/heatmap/pulse.ts): checking pulses up (~300 ms), unchecking dips
// (~180 ms), so each answers and they read differently. Scale only; callers
// skip both with reduced motion.
import {
	Easing,
	type SharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";

export function pulse(scale: SharedValue<number>) {
	scale.set(
		withSequence(
			withTiming(1.18, { duration: 120, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) })
		)
	);
}

export function release(scale: SharedValue<number>) {
	scale.set(
		withSequence(
			withTiming(0.88, { duration: 80, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) })
		)
	);
}

/** Fade/scale of a check mark or fill appearing (1) or leaving (0). */
export const MARK_MS = 150;
