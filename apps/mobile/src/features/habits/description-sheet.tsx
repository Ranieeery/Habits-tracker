import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Habit } from "@habits/contracts";
import { descriptionPreview } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useRouter } from "expo-router";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAlpha } from "@/lib/color.ts";
import { IconButton } from "@/ui/button.tsx";
import { DescriptionText } from "@/ui/description-text.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";

// The body appears a beat after the sheet (DESIGN.md: 120-200 ms, opacity).
const BODY_ENTER = FadeIn.duration(150).reduceMotion(ReduceMotion.System);

/**
 * The quick look at a habit's description (2.12.0; 2.14.1 layout, DESIGN.md
 * "Descrição de hábito"), opened from the note icon of a day's row: the name
 * in the display face (two lines at most), the first lines (core
 * `descriptionPreview`), faded at the end when something was left out, then a
 * divider and "Abrir descrição completa" (the habit's screen), always there,
 * outside the scroll so a big font never pushes it away. A Modal like the
 * other sheets: back and a tap outside close it; it does not slide with the
 * system's "remove animations".
 */
export function DescriptionSheet({
	habit,
	onClose,
}: {
	habit: Pick<Habit, "id" | "name" | "description"> | null;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const reduced = useReducedMotion();
	const preview = habit ? descriptionPreview(habit.description) : null;

	return (
		<Modal
			visible={habit !== null}
			transparent
			animationType={reduced ? "none" : "slide"}
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={onClose}
		>
			<View style={[styles.bottom, { paddingTop: insets.top + 8 }]}>
				<Pressable
					accessible={false}
					importantForAccessibility="no"
					onPress={onClose}
					style={StyleSheet.absoluteFill}
					className="bg-night-bg/70"
				/>
				{habit && preview ? (
					<View
						accessibilityViewIsModal
						className="rounded-t-2xl border-t border-night-border bg-night-surface pt-2"
						style={{ paddingBottom: insets.bottom + 8, flexShrink: 1 }}
					>
						<View className="items-center py-1">
							<View className="h-1 w-10 rounded-full bg-night-surface-raised" />
						</View>
						<View className="flex-row items-start gap-2 pt-2 pr-2 pl-5">
							<DisplayText
								weight="semibold"
								accessibilityRole="header"
								numberOfLines={2}
								className="flex-1 pt-2 text-xl leading-7 text-night-foreground"
							>
								{habit.name}
							</DisplayText>
							<IconButton icon="close" label="Fechar" onPress={onClose} />
						</View>
						<View style={styles.body}>
							<ScrollView
								contentContainerStyle={styles.scroll}
								style={{ flexShrink: 1 }}
							>
								<Animated.View entering={BODY_ENTER}>
									<DescriptionText blocks={preview.blocks} variant="preview" />
								</Animated.View>
							</ScrollView>
							{preview.truncated ? (
								<View
									pointerEvents="none"
									importantForAccessibility="no-hide-descendants"
									style={styles.fade}
								/>
							) : null}
						</View>
						<View className="h-px bg-night-border" />
						<PressableScale
							accessibilityRole="button"
							accessibilityLabel="Abrir descrição completa"
							accessibilityHint="Abre a página do hábito"
							onPress={() => {
								onClose();
								router.push(`/habit/about/${habit.id}`);
							}}
							className="min-h-14 flex-row items-center justify-between gap-2 px-5 active:bg-night-surface-raised"
						>
							<Text className="flex-1 text-base font-semibold text-night-accent-text">
								Abrir descrição completa
							</Text>
							<MaterialCommunityIcons
								name="arrow-right"
								size={20}
								color={nightColors.accent.text}
							/>
						</PressableScale>
					</View>
				) : null}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	bottom: { flex: 1, justifyContent: "flex-end" },
	body: { flexShrink: 1 },
	scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
	// The end of a cut preview fades into the sheet (about two lines). RN's
	// own gradient (`experimental_backgroundImage`, like `ui/backdrop.tsx`):
	// no native module, so it ships as an OTA update.
	fade: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 56,
		experimental_backgroundImage: `linear-gradient(to bottom, ${withAlpha(nightColors.surface.DEFAULT, 0)} 0%, ${withAlpha(nightColors.surface.DEFAULT, 0.92)} 100%)`,
	},
});
