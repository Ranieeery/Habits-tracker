import type { CalendarDate } from "@habits/contracts";
import { newHabitNotice } from "@habits/core";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	type TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useCreateHabit, useNewId } from "@/data/hooks.ts";
import { useUserTimeZone } from "@/data/today.ts";
import {
	HabitForm,
	type HabitFormValues,
} from "@/features/habits/habit-form.tsx";
import { Button, IconButton } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { useToast } from "@/ui/toast.tsx";

/**
 * "Novo hábito" for today's view: a full-width button (the screen's fixed
 * footer, in reach of the thumb) that opens a bottom sheet with the habits
 * form. The habit starts today and is written to the device database (the
 * outbox), so this works offline and the list shows it at once. The sheet is
 * a Modal: on Android its own window, which keeps TalkBack inside it; the
 * keyboard pushes it up (react-native-keyboard-controller follows Modals),
 * and closing it gives the accessibility focus back to the button.
 */
export function NewHabitSheet({ today }: { today: CalendarDate }) {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const toast = useToast();
	const newId = useNewId();
	const timeZone = useUserTimeZone();
	const create = useCreateHabit();
	// The id of the habit being created: one per opening, null when closed.
	const [habitId, setHabitId] = useState<string | null>(null);
	const [error, setError] = useState<string>();
	const sending = useRef(false);
	const wasOpen = useRef(false);
	const buttonRef = useRef<View>(null);
	const nameRef = useRef<TextInput>(null);

	useEffect(() => {
		if (habitId !== null) {
			wasOpen.current = true;
			return;
		}
		if (!wasOpen.current) return;
		wasOpen.current = false;
		// After the slide-out, so TalkBack lands on the button again.
		const timer = setTimeout(() => {
			if (buttonRef.current) {
				AccessibilityInfo.sendAccessibilityEvent(buttonRef.current, "focus");
			}
		}, 350);
		return () => clearTimeout(timer);
	}, [habitId]);

	const open = () => {
		setError(undefined);
		setHabitId(newId());
	};

	const close = () => {
		if (!sending.current) setHabitId(null);
	};

	const submit = ({ name, schedule, start_date }: HabitFormValues) => {
		if (habitId === null || sending.current || !schedule) return;
		sending.current = true;
		setError(undefined);
		create.mutate(
			// Starts today or later ("Começa em"): never rewrites past days.
			{ id: habitId, name, schedule, start_date },
			{
				onSuccess: (habit) => {
					sending.current = false;
					setHabitId(null);
					const notice = newHabitNotice(habit, today, { timeZone });
					if (notice) toast("success", notice);
				},
				onError: (failure) => {
					sending.current = false;
					if (!isUnauthorized(failure)) {
						setError(
							`Não foi possível criar o hábito. ${errorMessage(failure)}`
						);
					}
				},
			}
		);
	};

	return (
		<>
			<Button
				ref={buttonRef}
				icon="plus"
				label="Novo hábito"
				accessibilityHint="Abre um formulário para criar um hábito que começa hoje"
				onPress={open}
				className="min-h-14"
			/>
			<Modal
				visible={habitId !== null}
				transparent
				animationType="slide"
				statusBarTranslucent
				navigationBarTranslucent
				onRequestClose={close}
				onShow={() => nameRef.current?.focus()}
			>
				<KeyboardAvoidingView behavior="padding" style={styles.fill}>
					<View style={styles.bottom}>
						{/* Tapping outside closes; screen readers use "Fechar". */}
						<Pressable
							accessible={false}
							importantForAccessibility="no"
							onPress={close}
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
							<View className="flex-row items-center justify-between gap-2">
								<DisplayText
									accessibilityRole="header"
									className="flex-1 text-2xl tracking-tight text-night-foreground"
								>
									Novo hábito
								</DisplayText>
								<IconButton icon="close" label="Fechar" onPress={close} />
							</View>
							<Text className="text-sm text-night-muted">
								Começa a contar na data escolhida e não muda os dias anteriores.
							</Text>
							{habitId !== null ? (
								// The form grows with the repetition fields: it scrolls
								// inside the sheet, which never covers the status bar.
								<ScrollView
									style={{ maxHeight: height * 0.6 }}
									keyboardShouldPersistTaps="handled"
								>
									<HabitForm
										key={habitId}
										today={today}
										timeZone={timeZone}
										submitLabel="Criar hábito"
										pending={create.isPending}
										error={error}
										nameRef={nameRef}
										onSubmit={submit}
									/>
								</ScrollView>
							) : null}
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	bottom: { flex: 1, justifyContent: "flex-end" },
});
