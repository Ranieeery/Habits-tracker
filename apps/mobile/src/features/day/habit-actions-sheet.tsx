import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Habit } from "@habits/contracts";
import {
	ARCHIVE_NOTICE,
	ARCHIVED_BADGE,
	ARCHIVED_TOAST,
	type HabitActionId,
	habitActions,
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
import { useUpdateHabit } from "@/data/hooks.ts";
import { useToday, useUserTimeZone } from "@/data/today.ts";
import {
	HabitForm,
	type HabitFormValues,
} from "@/features/habits/habit-form.tsx";
import { BottomSheet } from "@/ui/bottom-sheet.tsx";
import type { IconName } from "@/ui/button.tsx";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { useToast } from "@/ui/toast.tsx";

const ICONS: Record<HabitActionId, IconName> = {
	edit: "pencil-outline",
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
 */
export function HabitActionsSheet({
	habit,
	open,
	origin,
	onClose,
}: {
	/** The last habit opened: it stays while the sheet slides out. */
	habit: Habit | null;
	open: boolean;
	/** The element to give the focus back to (the row's "more options"). */
	origin: View | null;
	onClose: () => void;
}) {
	const router = useRouter();
	const toast = useToast();
	const update = useUpdateHabit();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const { height } = useWindowDimensions();
	const [editing, setEditing] = useState(false);
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
		if (update.isPending) return;
		setEditing(false);
		setError(undefined);
		onClose();
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
				setEditing(true);
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
					setEditing(false);
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
			title={editing ? "Editar hábito" : (target?.name ?? "")}
			titleRef={titleRef}
			onClose={close}
			onShow={() => {
				if (titleRef.current) {
					AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
				}
			}}
		>
			{target && editing ? (
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
					{habitActions(target).map((action) => (
						<PressableScale
							key={action.id}
							accessibilityRole="button"
							accessibilityLabel={action.label}
							accessibilityHint={action.hint}
							onPress={() => run(target, action.id)}
							className={`-mx-2 min-h-14 flex-row items-center gap-4 rounded-lg px-3 py-2 ${action.careful ? "active:bg-night-warning-surface" : "active:bg-night-surface-raised"}`}
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
									className={`text-base font-medium ${action.careful ? "text-night-warning" : "text-night-foreground"}`}
								>
									{action.label}
								</Text>
								{action.hint ? (
									<Text className="text-sm text-night-muted">
										{action.hint}
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
	show: (habit: Habit, origin: View | null) => void;
	sheet: ReactNode;
} {
	const [state, setState] = useState<{
		habit: Habit | null;
		open: boolean;
		origin: View | null;
	}>({ habit: null, open: false, origin: null });
	return {
		show: (habit, origin) => setState({ habit, open: true, origin }),
		sheet: (
			<HabitActionsSheet
				habit={state.habit}
				open={state.open}
				origin={state.origin}
				onClose={() => setState((current) => ({ ...current, open: false }))}
			/>
		),
	};
}
