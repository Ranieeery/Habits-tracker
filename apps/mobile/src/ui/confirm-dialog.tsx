import { useEffect, useRef } from "react";
import {
	AccessibilityInfo,
	Keyboard,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, {
	FadeIn,
	Keyframe,
	ReduceMotion,
} from "react-native-reanimated";
import { Button } from "./button.tsx";
import { DisplayText } from "./display-text.tsx";

const BACKDROP_ENTER = FadeIn.duration(150).reduceMotion(ReduceMotion.System);
const CARD_ENTER = new Keyframe({
	0: { opacity: 0, transform: [{ scale: 0.96 }] },
	100: { opacity: 1, transform: [{ scale: 1 }] },
})
	.duration(150)
	.reduceMotion(ReduceMotion.System);

/**
 * A centered confirmation (2.16.2: "Descartar alterações?"), drawn by the app
 * instead of `Alert`, which takes neither the warning token nor the motion
 * rules. `inline`: a layer inside the window that is already open (a
 * `BottomSheet`, so two Modals are never stacked); otherwise its own
 * transparent Modal (a screen), where Android back means "cancel". The
 * keyboard is closed when it opens (it would cover the buttons) and the
 * accessibility focus goes to the safe action, "cancel"; a tap outside
 * cancels too. `onConfirm` runs once per opening, however many taps.
 */
export function ConfirmDialog({
	visible,
	inline = false,
	title,
	body,
	cancelLabel,
	confirmLabel,
	onCancel,
	onConfirm,
}: {
	visible: boolean;
	inline?: boolean;
	title: string;
	body: string;
	cancelLabel: string;
	confirmLabel: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const card = visible ? (
		<ConfirmCard
			title={title}
			body={body}
			cancelLabel={cancelLabel}
			confirmLabel={confirmLabel}
			onCancel={onCancel}
			onConfirm={onConfirm}
		/>
	) : null;
	if (inline) return card;
	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={onCancel}
		>
			{card}
		</Modal>
	);
}

function ConfirmCard({
	title,
	body,
	cancelLabel,
	confirmLabel,
	onCancel,
	onConfirm,
}: {
	title: string;
	body: string;
	cancelLabel: string;
	confirmLabel: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const cancelRef = useRef<View>(null);
	const confirmed = useRef(false);

	useEffect(() => {
		Keyboard.dismiss();
		// After the layer is on screen, so TalkBack moves into it.
		const timer = setTimeout(() => {
			if (cancelRef.current) {
				AccessibilityInfo.sendAccessibilityEvent(cancelRef.current, "focus");
			}
		}, 100);
		return () => clearTimeout(timer);
	}, []);

	return (
		<View style={StyleSheet.absoluteFill}>
			<Animated.View entering={BACKDROP_ENTER} style={StyleSheet.absoluteFill}>
				<Pressable
					accessible={false}
					importantForAccessibility="no"
					onPress={onCancel}
					style={StyleSheet.absoluteFill}
					className="bg-night-bg/70"
				/>
			</Animated.View>
			<View style={styles.center}>
				<Animated.View entering={CARD_ENTER} style={styles.card}>
					<View
						accessibilityViewIsModal
						className="gap-3 rounded-2xl border border-night-border bg-night-surface-overlay p-5"
					>
						<DisplayText
							accessibilityRole="header"
							className="text-2xl tracking-tight text-night-foreground"
						>
							{title}
						</DisplayText>
						<Text className="text-base text-night-muted">{body}</Text>
						<View className="flex-row flex-wrap justify-end gap-2 pt-2">
							<Button
								ref={cancelRef}
								variant="primary"
								label={cancelLabel}
								accessibilityHint={`${title} ${body}`}
								onPress={onCancel}
							/>
							<Button
								variant="careful"
								label={confirmLabel}
								onPress={() => {
									if (confirmed.current) return;
									confirmed.current = true;
									onConfirm();
								}}
							/>
						</View>
					</View>
				</Animated.View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	center: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 16,
		pointerEvents: "box-none",
	},
	card: { width: "100%", maxWidth: 400 },
});
