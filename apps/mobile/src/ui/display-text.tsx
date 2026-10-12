import type { ComponentProps } from "react";
import { Text } from "react-native";
import { displayFont } from "./fonts.ts";

/**
 * Text in the display face (numbers, year, panel titles, wordmark). Colors
 * and sizes come from `className`; the weight picks the font file.
 */
export function DisplayText({
	weight = "bold",
	style,
	...props
}: ComponentProps<typeof Text> & { weight?: keyof typeof displayFont }) {
	return (
		<Text {...props} style={[{ fontFamily: displayFont[weight] }, style]} />
	);
}
