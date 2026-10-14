import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
	KeyboardAvoidingView,
	useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./button.tsx";
import { DisplayText } from "./display-text.tsx";
import { useReducedMotion } from "./use-reduced-motion.ts";

/**
 * A bottom sheet (extracted from "Novo hábito" in 2.15.0, no sheet library):
 * a React Native `Modal` (on Android its own window, which keeps TalkBack
 * inside it), a dimmed backdrop that closes on a tap, the handle, a title in
 * the display face and "Fechar". The keyboard pushes it up
 * (react-native-keyboard-controller follows Modals) and the sheet shrinks to
 * the space above it, below the status bar, so long content scrolls inside
 * (2.10.1). It does not slide with the system's "remove animations".
 * `overlay` (2.16.2) is drawn over everything inside the same Modal (an
 * inline `ConfirmDialog`), so a question never needs a second Modal.
 */
export function BottomSheet({
	visible,
	title,
	titleRef,
	onClose,
	onShow,
	overlay,
	children,
}: {
	visible: boolean;
	title: string;
	/** The title, to move the accessibility focus to it on opening. */
	titleRef?: React.Ref<View>;
	onClose: () => void;
	onShow?: () => void;
	/** Over the sheet, in the same window (2.16.2). */
	overlay?: ReactNode;
	children: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardState((state) => state.isVisible);
	const reduced = useReducedMotion();
	return (
		<Modal
			visible={visible}
			transparent
			animationType={reduced ? "none" : "slide"}
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={onClose}
			onShow={onShow}
		>
			<KeyboardAvoidingView behavior="padding" style={styles.fill}>
				<View style={[styles.bottom, { paddingTop: insets.top + 8 }]}>
					{/* Tapping outside closes; screen readers use "Fechar". */}
					<Pressable
						accessible={false}
						importantForAccessibility="no"
						onPress={onClose}
						style={StyleSheet.absoluteFill}
						className="bg-night-bg/70"
					/>
					<View
						accessibilityViewIsModal
						className="gap-4 rounded-t-2xl border-t border-night-border bg-night-surface px-4 pt-2"
						style={{
							flexShrink: 1,
							// The keyboard already covers the navigation bar.
							paddingBottom: (keyboardVisible ? 0 : insets.bottom) + 16,
						}}
					>
						<View className="items-center py-1">
							<View className="h-1 w-10 rounded-full bg-night-surface-raised" />
						</View>
						<View className="flex-row items-start justify-between gap-2">
							<View ref={titleRef} accessible className="flex-1 pt-1.5">
								<DisplayText
									accessibilityRole="header"
									numberOfLines={2}
									className="text-2xl tracking-tight text-night-foreground"
								>
									{title}
								</DisplayText>
							</View>
							<IconButton icon="close" label="Fechar" onPress={onClose} />
						</View>
						{children}
					</View>
				</View>
			</KeyboardAvoidingView>
			{overlay}
		</Modal>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	bottom: { flex: 1, justifyContent: "flex-end" },
});
