import type { ComponentProps } from "react";
import {
	type GestureResponderEvent,
	Pressable,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "./use-reduced-motion.ts";

const PRESSED = 0.97;
const DURATION = 100;

/**
 * A `Pressable` that sinks a little while pressed (DESIGN.md "Movimento",
 * 2.7.0): scale 0.97 in 100 ms and back, transform only, the selection
 * feedback of buttons, chips, the week strip and cards. Still with reduced
 * motion. The scale lives on an outer Reanimated view; the plain `Pressable`
 * inside keeps `className` and its `active:` states (an animated Pressable
 * loses NativeWind's `className`). Layout the parent needs (e.g. `flex: 1`
 * in a row) goes in `outerStyle` (a plain style: Reanimated views take
 * `style`, not `className`).
 */
export function PressableScale({
	outerStyle,
	onPressIn,
	onPressOut,
	...props
}: ComponentProps<typeof Pressable> & {
	className?: string;
	outerStyle?: StyleProp<ViewStyle>;
}) {
	const reduced = useReducedMotion();
	const scale = useSharedValue(1);
	const animated = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));
	const to = (value: number) => {
		if (reduced) return;
		scale.set(
			withTiming(value, { duration: DURATION, easing: Easing.out(Easing.quad) })
		);
	};
	return (
		<Animated.View style={[outerStyle, animated]}>
			<Pressable
				{...props}
				onPressIn={(event: GestureResponderEvent) => {
					to(PRESSED);
					onPressIn?.(event);
				}}
				onPressOut={(event: GestureResponderEvent) => {
					to(1);
					onPressOut?.(event);
				}}
			/>
		</Animated.View>
	);
}
