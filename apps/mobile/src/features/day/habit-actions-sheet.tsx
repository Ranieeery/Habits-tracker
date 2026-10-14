import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import {
	ARCHIVE_NOTICE,
	ARCHIVED_BADGE,
	ARCHIVED_TOAST,
	type HabitActionId,
	habitActions,
	RESCHEDULE_UNDONE_TOAST,
	type RescheduleAvailability,
	rescheduledToast,
	UNARCHIVED_TOAST,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	ScrollView,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import {
	useNewId,
	useRescheduleHabit,
	useScheduleOptions,
	useUndoReschedule,
	useUpdateHabit,
} from "@/data/hooks.ts";
import { useToday, useUserTimeZone } from "@/data/today.ts";
import {
	HabitForm,
	type HabitFormValues,
} from "@/features/habits/habit-form.tsx";
import { BottomSheet } from "@/ui/bottom-sheet.tsx";
import type { IconName } from "@/ui/button.tsx";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { useToast } from "@/ui/toast.tsx";
import { type OccurrenceTarget, RescheduleForm } from "./reschedule-form.tsx";

const ICONS: Record<HabitActionId, IconName> = {
	edit: "pencil-outline",
	reschedule: "calendar-arrow-right",
	description: "text-box-outline",
	archive: "archive-outline",
	unarchive: "archive-arrow-up-outline",
};

/**
 * The habit actions menu of a day's rows (2.15.0), as one bottom sheet per
 * list, opened from a row's "more options" button or a long press. Its items
 * come from core's declarative `habitActions` (labels and order in one
 * place). "Editar hábito" swaps the sheet's content for the habits form (the
 * same Modal: never two stacked), saved through the outbox (offline too)
 * without leaving the day; a failure keeps what was typed. "Ver descrição
 * completa" opens the habit's page. "Arquivar"/"Desarquivar" are immediate,
 * with "Desfazer" for 6 s in the toast (it unarchives). The accessibility
 * focus goes to the title on opening and back to `origin` on closing.
 * 2.16.0: "Adiar" swaps the content for the postponement form
 * (`RescheduleForm`), written to the outbox like the rest (offline too), with
 * "Adiado para 27/10" and "Desfazer" in the toast; at the limit the item
 * stays, disabled, with the reason.
 */

/** What a row adds for "Adiar" (2.16.0). */
export interface RescheduleContext {
	availability: RescheduleAvailability;
	occurrence: OccurrenceTarget;
	/** "Arquivar"/"Desarquivar" too (false on the preview days). */
	archive?: boolean;
}
export function HabitActionsSheet({
	habit,
	context,
	open,
	origin,
	onClose,
}: {
	/** The last habit opened: it stays while the sheet slides out. */
	habit: Habit | null;
	context: RescheduleContext | null;
	open: boolean;
	/** The element to give the focus back to (the row's "more options"). */
	origin: View | null;
	onClose: () => void;
}) {
	const router = useRouter();
	const toast = useToast();
	const update = useUpdateHabit();
	const postpone = useRescheduleHabit();
	const undoPostpone = useUndoReschedule();
	const newId = useNewId();
	const { reschedules } = useScheduleOptions();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const { height } = useWindowDimensions();
	const [mode, setMode] = useState<"actions" | "edit" | "reschedule">(
		"actions"
	);
	const editing = mode === "edit";
	const [error, setError] = useState<string>();
	const titleRef = useRef<View>(null);

	const wasOpen = useRef(false);
	useEffect(() => {
		if (open) {
			wasOpen.current = true;
			return;
		}
		if (!wasOpen.current) return;
		wasOpen.current = false;
		// After the slide-out, so TalkBack lands on the button again.
		const timer = setTimeout(() => {
			if (origin) AccessibilityInfo.sendAccessibilityEvent(origin, "focus");
		}, 350);
		return () => clearTimeout(timer);
	}, [open, origin]);

	const close = () => {
		if (update.isPending || postpone.isPending) return;
		setMode("actions");
		setError(undefined);
		onClose();
	};

	const reschedule = (
		target: Habit,
		occurrence: OccurrenceTarget,
		to: CalendarDate
	) => {
		setError(undefined);
		const id = newId();
		postpone.mutate(
			{
				habitId: target.id,
				request: {
					id,
					original_date: occurrence.original,
					from_date: occurrence.effective,
					to_date: to,
					sequence: occurrence.count + 1,
				},
			},
			{
				onSuccess: () => {
					setMode("actions");
					onClose();
					toast("info", rescheduledToast(to, today), target.name, {
						action: {
							label: "Desfazer",
							onPress: () =>
								undoPostpone.mutate(
									{ habitId: target.id, rescheduleId: id },
									{
										onSuccess: () =>
											toast("info", RESCHEDULE_UNDONE_TOAST, target.name),
										onError: (failure) => {
											if (!isUnauthorized(failure)) {
												toast(
													"error",
													"Não foi possível desfazer o adiamento",
													errorMessage(failure)
												);
											}
										},
									}
								),
						},
					});
				},
				onError: (failure) => {
					if (!isUnauthorized(failure)) {
						// The repository's message is core's reason (pt-BR).
						setError(failure.message || errorMessage(failure));
					}
				},
			}
		);
	};

	const setArchived = (target: Habit, archived: boolean, undo = false) =>
		update.mutate(
			{ habitId: target.id, changes: { archived } },
			{
				onSuccess: () => {
					if (!archived) {
						toast(
							"info",
							undo ? "Alteração desfeita" : UNARCHIVED_TOAST,
							target.name
						);
						return;
					}
					toast("info", ARCHIVED_TOAST, `${target.name}. ${ARCHIVE_NOTICE}`, {
						action: {
							label: "Desfazer",
							onPress: () => setArchived(target, false, true),
						},
					});
				},
				onError: (failure) => {
					if (!isUnauthorized(failure)) {
						toast(
							"error",
							archived
								? "Não foi possível arquivar o hábito"
								: "Não foi possível desarquivar o hábito",
							errorMessage(failure)
						);
					}
				},
			}
		);

	const run = (target: Habit, action: HabitActionId) => {
		switch (action) {
			case "edit":
				setError(undefined);
				setMode("edit");
				return;
			case "reschedule":
				setError(undefined);
				setMode("reschedule");
				return;
			case "description":
				close();
				router.push(`/habit/about/${target.id}`);
				return;
			case "archive":
			case "unarchive":
				close();
				setArchived(target, action === "archive");
				return;
		}
	};

	const save = (target: Habit, values: HabitFormValues) => {
		setError(undefined);
		update.mutate(
			{
				habitId: target.id,
				changes: {
					name: values.name,
					description: values.description,
					...(values.schedule && { schedule: values.schedule }),
				},
			},
			{
				onSuccess: () => {
					setMode("actions");
					onClose();
					toast("success", "Hábito salvo", values.name);
				},
				onError: (failure) => {
					if (!isUnauthorized(failure)) {
						setError(
							`Não foi possível salvar o hábito. ${errorMessage(failure)}`
						);
					}
				},
			}
		);
	};

	const target = habit;
	return (
		<BottomSheet
			visible={open}
			title={
				mode === "edit"
					? "Editar hábito"
					: mode === "reschedule"
						? `Adiar ${target?.name ?? ""}`
						: (target?.name ?? "")
			}
			titleRef={titleRef}
			onClose={close}
			onShow={() => {
				if (titleRef.current) {
					AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
				}
			}}
		>
			{target && mode === "reschedule" && context ? (
				<ScrollView
					style={{ maxHeight: height * 0.7, flexShrink: 1 }}
					keyboardShouldPersistTaps="handled"
				>
					<RescheduleForm
						key={`${target.id}:${context.occurrence.effective}`}
						habit={target}
						occurrence={context.occurrence}
						today={today}
						pending={postpone.isPending}
						error={error}
						onCancel={() => {
							setError(undefined);
							setMode("actions");
						}}
						onSubmit={(to) => reschedule(target, context.occurrence, to)}
					/>
				</ScrollView>
			) : target && editing ? (
				<>
					<Text className="text-sm text-night-muted">
						Vale para todos os dias. Mudar a repetição altera também a contagem
						dos dias passados.
					</Text>
					<ScrollView
						style={{ maxHeight: height * 0.6, flexShrink: 1 }}
						keyboardShouldPersistTaps="handled"
					>
						<HabitForm
							key={target.id}
							initial={target}
							today={today}
							timeZone={timeZone}
							reschedules={reschedules}
							submitLabel="Salvar"
							pending={update.isPending}
							error={error}
							onSubmit={(values) => save(target, values)}
						/>
					</ScrollView>
				</>
			) : target ? (
				<View className="gap-1">
					{target.archived_at !== null ? (
						<View className="mb-2 flex-row items-center gap-1 self-start rounded-md border border-night-border-strong px-2 py-0.5">
							<MaterialCommunityIcons
								name="archive-outline"
								size={14}
								color={nightColors.muted}
							/>
							<Text className="text-xs font-medium text-night-muted">
								{ARCHIVED_BADGE}
							</Text>
						</View>
					) : null}
					{habitActions(target, context?.availability, {
						archive: context?.archive ?? true,
					}).map((action) => (
						<PressableScale
							key={action.id}
							accessibilityRole="button"
							accessibilityLabel={action.label}
							accessibilityHint={action.disabledReason ?? action.hint}
							// 2.16.0: shown but unavailable, with the reason.
							accessibilityState={{
								disabled: action.disabledReason !== undefined,
							}}
							onPress={() => {
								if (action.disabledReason === undefined) {
									run(target, action.id);
								}
							}}
							className={`-mx-2 min-h-14 flex-row items-center gap-4 rounded-lg px-3 py-2 ${action.disabledReason !== undefined ? "" : action.careful ? "active:bg-night-warning-surface" : "active:bg-night-surface-raised"}`}
						>
							<MaterialCommunityIcons
								name={ICONS[action.id]}
								size={22}
								color={
									action.careful
										? nightColors.warning.DEFAULT
										: nightColors.muted
								}
							/>
							<View className="flex-1">
								<Text
									className={`text-base font-medium ${action.disabledReason !== undefined ? "text-night-subtle" : action.careful ? "text-night-warning" : "text-night-foreground"}`}
								>
									{action.label}
								</Text>
								{(action.disabledReason ?? action.hint) ? (
									<Text className="text-sm text-night-muted">
										{action.disabledReason ?? action.hint}
									</Text>
								) : null}
							</View>
						</PressableScale>
					))}
				</View>
			) : null}
		</BottomSheet>
	);
}

/**
 * The state of one list's actions sheet: `show(habit, origin)` opens it
 * for a row (origin = its "more options" button) and `sheet` renders it.
 */
export function useHabitActionsSheet(): {
	show: (
		habit: Habit,
		origin: View | null,
		context?: RescheduleContext
	) => void;
	sheet: ReactNode;
} {
	const [state, setState] = useState<{
		habit: Habit | null;
		context: RescheduleContext | null;
		open: boolean;
		origin: View | null;
	}>({ habit: null, context: null, open: false, origin: null });
	return {
		show: (habit, origin, context) =>
			setState({ habit, context: context ?? null, open: true, origin }),
		sheet: (
			<HabitActionsSheet
				habit={state.habit}
				context={state.context}
				open={state.open}
				origin={state.origin}
				onClose={() => setState((current) => ({ ...current, open: false }))}
			/>
		),
	};
}
