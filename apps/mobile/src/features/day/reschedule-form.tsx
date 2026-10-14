import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import {
	formatDayMonth,
	rescheduleBounds,
	rescheduleShortcuts,
	rescheduleSummary,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/ui/button.tsx";
import { DatePicker } from "@/ui/date-picker.tsx";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { FieldError } from "@/ui/text-field.tsx";

/** The occurrence a row shows: its nominal and effective dates and count. */
export interface OccurrenceTarget {
	original: CalendarDate;
	effective: CalendarDate;
	count: number;
}

/**
 * "Adiar" inside the actions sheet (2.16.0): quick choices from core
 * (`rescheduleShortcuts`; invalid ones disabled with the reason), "Escolher
 * data" with the habit form's date picker limited to the valid range
 * (`rescheduleBounds`), and the effect before confirming
 * (`rescheduleSummary`). The parent writes it to the outbox (offline too);
 * a failure comes back as `error` and the choice stays.
 */
export function RescheduleForm({
	habit,
	occurrence,
	today,
	pending,
	error,
	onCancel,
	onSubmit,
}: {
	habit: Habit;
	occurrence: OccurrenceTarget;
	today: CalendarDate;
	pending: boolean;
	error?: string;
	onCancel: () => void;
	onSubmit: (to: CalendarDate) => void;
}) {
	const bounds = rescheduleBounds(habit, occurrence, today);
	const shortcuts = bounds
		? rescheduleShortcuts(occurrence.effective, today, bounds)
		: [];
	const firstValid = shortcuts.find((choice) => !choice.disabledReason);
	const [choice, setChoice] = useState<CalendarDate | "pick">(
		firstValid?.date ?? "pick"
	);
	const [picked, setPicked] = useState<CalendarDate | "">("");
	const to = choice === "pick" ? picked : choice;

	if (!bounds) {
		return (
			<Text className="text-sm text-night-muted">
				Não há data possível antes da próxima ocorrência.
			</Text>
		);
	}
	const summary =
		to === ""
			? null
			: rescheduleSummary({
					effective: occurrence.effective,
					to,
					count: occurrence.count,
					today,
				});

	const option = (
		key: string,
		label: string,
		detail: string | null,
		trailing: string | null,
		selected: boolean,
		disabled: boolean,
		onPress: () => void
	) => (
		<PressableScale
			key={key}
			accessibilityRole="radio"
			accessibilityLabel={[label, trailing, detail].filter(Boolean).join(", ")}
			accessibilityState={{ selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			className={`min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-2 ${
				disabled
					? "border-night-border"
					: selected
						? "border-night-accent bg-night-accent/15"
						: "border-night-border-strong active:bg-night-surface-raised"
			}`}
		>
			<View className="flex-1">
				<Text
					className={`text-base font-medium ${disabled ? "text-night-subtle" : "text-night-foreground"}`}
				>
					{label}
				</Text>
				{detail ? (
					<Text className="text-sm text-night-muted">{detail}</Text>
				) : null}
			</View>
			{trailing ? (
				<Text className="text-sm text-night-muted">{trailing}</Text>
			) : (
				<MaterialCommunityIcons
					name="calendar-month-outline"
					size={20}
					color={nightColors.muted}
				/>
			)}
		</PressableScale>
	);

	return (
		<View className="gap-4">
			<Text className="text-sm text-night-muted">
				Só a ocorrência de {formatDayMonth(occurrence.original, today)}. A
				repetição do hábito não muda.
			</Text>
			<View accessibilityRole="radiogroup" className="gap-2">
				{shortcuts.map((shortcut) =>
					option(
						shortcut.label,
						shortcut.label,
						shortcut.disabledReason,
						formatDayMonth(shortcut.date, today),
						choice === shortcut.date,
						shortcut.disabledReason !== null,
						() => setChoice(shortcut.date)
					)
				)}
				{option(
					"pick",
					"Escolher data",
					null,
					null,
					choice === "pick",
					false,
					() => setChoice("pick")
				)}
			</View>
			{choice === "pick" ? (
				<DatePicker
					label="Nova data"
					value={picked}
					min={bounds.min}
					max={bounds.max}
					onChange={setPicked}
				/>
			) : null}
			<View
				accessibilityLiveRegion="polite"
				className="rounded-xl border border-night-border bg-night-bg px-4 py-3"
			>
				{summary ? (
					<>
						<Text className="text-sm text-night-foreground">
							{summary.effect}
						</Text>
						<Text
							className={`text-sm ${summary.last ? "text-night-warning" : "text-night-muted"}`}
						>
							{summary.remaining}
						</Text>
					</>
				) : (
					<Text className="text-sm text-night-muted">Escolha a nova data.</Text>
				)}
			</View>
			{error ? <FieldError>{error}</FieldError> : null}
			<View className="gap-2">
				<Button
					label="Adiar"
					pending={pending}
					disabled={to === ""}
					onPress={() => {
						if (to !== "") onSubmit(to);
					}}
				/>
				<Button variant="ghost" label="Cancelar" onPress={onCancel} />
			</View>
		</View>
	);
}
