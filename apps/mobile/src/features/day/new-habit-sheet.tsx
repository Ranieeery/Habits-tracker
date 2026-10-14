import type { CalendarDate } from "@habits/contracts";
import { newHabitNotice } from "@habits/core";
import { useEffect, useRef, useState } from "react";
import type { View } from "react-native";
import {
	AccessibilityInfo,
	ScrollView,
	Text,
	type TextInput,
	useWindowDimensions,
} from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useCreateHabit, useNewId } from "@/data/hooks.ts";
import { useUserTimeZone } from "@/data/today.ts";
import {
	HabitForm,
	type HabitFormValues,
} from "@/features/habits/habit-form.tsx";
import { BottomSheet } from "@/ui/bottom-sheet.tsx";
import { Button } from "@/ui/button.tsx";
import { useToast } from "@/ui/toast.tsx";

/**
 * "Novo hábito" for today's view: a full-width button (the screen's fixed
 * footer, in reach of the thumb) that opens a bottom sheet with the habits
 * form. The habit starts today and is written to the device database (the
 * outbox), so this works offline and the list shows it at once. The sheet is
 * `BottomSheet` (the keyboard pushes it up and the form scrolls inside it,
 * 2.10.1). Closing it gives the accessibility focus back to the button.
 */
export function NewHabitSheet({ today }: { today: CalendarDate }) {
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

	const submit = ({
		name,
		description,
		schedule,
		start_date,
	}: HabitFormValues) => {
		if (habitId === null || sending.current || !schedule) return;
		sending.current = true;
		setError(undefined);
		create.mutate(
			// Starts today or later ("Começa em"): never rewrites past days.
			{ id: habitId, name, description, schedule, start_date },
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
			<BottomSheet
				visible={habitId !== null}
				title="Novo hábito"
				onClose={close}
				onShow={() => nameRef.current?.focus()}
			>
				<Text className="text-sm text-night-muted">
					Começa a contar na data escolhida e não muda os dias anteriores.
				</Text>
				{habitId !== null ? (
					// The form grows with the repetition fields: it scrolls
					// inside the sheet, and shrinks with it above the keyboard.
					<ScrollView
						style={{ maxHeight: height * 0.6, flexShrink: 1 }}
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
			</BottomSheet>
		</>
	);
}
