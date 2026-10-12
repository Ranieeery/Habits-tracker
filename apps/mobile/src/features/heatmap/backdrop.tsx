import { nightColors } from "@habits/design-tokens";
import { StyleSheet, View } from "react-native";
import { withAlpha } from "@/lib/color.ts";

// One fixed, subtle glow behind the top of the screen (DESIGN.md: "um brilho
// fixo e sutil no fundo"). A CSS radial gradient drawn by React Native core
// (`experimental_backgroundImage`): no image and no native gradient module,
// so it ships as an OTA update.
const glow = {
	experimental_backgroundImage: `radial-gradient(circle at 50% 0%, ${withAlpha(nightColors.glow, 0.22)} 0%, ${withAlpha(nightColors.glow, 0)} 65%)`,
};

export function Backdrop() {
	return (
		<View
			pointerEvents="none"
			importantForAccessibility="no-hide-descendants"
			style={[StyleSheet.absoluteFill, styles.frame]}
		>
			<View style={[styles.glow, glow]} />
		</View>
	);
}

const styles = StyleSheet.create({
	frame: { overflow: "hidden" },
	glow: {
		position: "absolute",
		top: -80,
		left: -120,
		right: -120,
		height: 420,
	},
});
