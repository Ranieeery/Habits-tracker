import type { CalendarDate } from "@habits/contracts";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatShortDate } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";

/** Waits for the Modal's slide before moving the screen reader's focus. */
const FOCUS_DELAY_MS = 350;

function focusLater(view: View | null) {
	return setTimeout(() => {
		if (view) AccessibilityInfo.sendAccessibilityEvent(view, "focus");
	}, FOCUS_DELAY_MS);
}

/**
 * The day screen's footer on a past day inside the backfill window. Locked:
 * "Editar este dia", which opens a bottom sheet asking for confirmation
 * (Cancelar gets the screen reader's focus; Android back and a tap outside
 * cancel). Unlocked: "Concluir edição" in the same place, so the thumb that
 * unlocked the day also locks it. The footer is fixed below the list (the
 * list scrolls above it), in one-handed reach, and never covers a habit.
 */
export function EditDayFooter({
	date,
	unlocked,
	onUnlock,
	onLock,
}: {
	date: CalendarDate;
	unlocked: boolean;
	onUnlock: () => void;
	onLock: () => void;
}) {
	const insets = useSafeAreaInsets();
	const [confirming, setConfirming] = useState(false);
	const buttonRef = useRef<View>(null);
	const cancelRef = useRef<View>(null);
	const wasUnlocked = useRef(unlocked);

	// The footer button changed label: put the focus back on it.
	useEffect(() => {
		if (wasUnlocked.current === unlocked) return;
		wasUnlocked.current = unlocked;
		const timer = focusLater(buttonRef.current);
		return () => clearTimeout(timer);
	}, [unlocked]);

	const cancel = () => {
		setConfirming(false);
		focusLater(buttonRef.current);
	};

	if (unlocked) {
		return (
			<Button
				ref={buttonRef}
				variant="secondary"
				icon="lock-outline"
				label="Concluir edição"
				accessibilityHint="Volta a bloquear este dia"
				onPress={onLock}
				className="min-h-14"
			/>
		);
	}

	return (
		<>
			<Button
				ref={buttonRef}
				variant="outline"
				icon="pencil-outline"
				label="Editar este dia"
				accessibilityHint="Pede confirmação para alterar um dia que já passou"
				onPress={() => setConfirming(true)}
				className="min-h-14"
			/>
			<Modal
				visible={confirming}
				transparent
				animationType="slide"
				statusBarTranslucent
				navigationBarTranslucent
				onRequestClose={cancel}
				onShow={() => focusLater(cancelRef.current)}
			>
				<View style={styles.bottom}>
					{/* Tapping outside cancels; screen readers use "Cancelar". */}
					<Pressable
						accessible={false}
						importantForAccessibility="no"
						onPress={cancel}
						style={StyleSheet.absoluteFill}
						className="bg-night-bg/70"
					/>
					<View
						accessibilityViewIsModal
						className="gap-4 rounded-t-2xl border-t border-night-border bg-night-surface px-4 pt-2"
						style={{ paddingBottom: insets.bottom + 16 }}
					>
						<View className="items-center py-1">
							<View className="h-1 w-10 rounded-full bg-night-surface-raised" />
						</View>
						<DisplayText
							accessibilityRole="header"
							className="text-2xl tracking-tight text-night-foreground"
						>
							Editar o dia {formatShortDate(date)}?
						</DisplayText>
						<Text className="text-base text-night-muted">
							Este dia já passou. Ao alterar, o mapa de hábitos e as sequências
							serão recalculados.
						</Text>
						{/* Cancelar comes first (and closest to the thumb's rest). */}
						<View className="gap-2">
							<Button
								ref={cancelRef}
								variant="secondary"
								label="Cancelar"
								onPress={cancel}
								className="min-h-14"
							/>
							<Button
								label="Editar"
								onPress={() => {
									setConfirming(false);
									onUnlock();
								}}
								className="min-h-14"
							/>
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	bottom: { flex: 1, justifyContent: "flex-end" },
});
