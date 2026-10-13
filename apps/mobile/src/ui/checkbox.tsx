import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { MARK_MS, pulse, release } from "./motion.ts";
import { useReducedMotion } from "./use-reduced-motion.ts";

/**
 * Visual only: the whole row around it is the target. The green fill and the
 * check mark are a layer over the empty box that fades and scales in or out,
 * so unchecking is seen as well as checking; the box pulses on check and dips
 * on uncheck (DESIGN.md "Movimento"; nothing with reduced motion). The mark
 * is `night-bg` on `night-success` (about 10:1).
 */
export function CheckboxBox({ checked }: { checked: boolean }) {
	const reduced = useReducedMotion();
	const scale = useSharedValue(1);
	const mark = useSharedValue(checked ? 1 : 0);
	const previous = useRef(checked);
	useEffect(() => {
		const changed = checked !== previous.current;
		previous.current = checked;
		if (!changed) return;
		if (reduced) {
			mark.set(checked ? 1 : 0);
			return;
		}
		mark.set(
			withTiming(checked ? 1 : 0, {
				duration: MARK_MS,
				easing: Easing.out(Easing.quad),
			})
		);
		(checked ? pulse : release)(scale);
	}, [checked, reduced, scale, mark]);
	const box = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));
	const fill = useAnimatedStyle(() => ({
		opacity: mark.get(),
		transform: [{ scale: 0.6 + 0.4 * mark.get() }],
	}));

	return (
		<Animated.View style={box}>
			<View className="size-7 rounded-md border-2 border-night-border-strong bg-night-bg">
				<Animated.View
					style={fill}
					className="absolute -inset-0.5 items-center justify-center rounded-md bg-night-success"
				>
					<MaterialCommunityIcons
						name="check-bold"
						size={18}
						color={nightColors.bg}
					/>
				</Animated.View>
			</View>
		</Animated.View>
	);
}
