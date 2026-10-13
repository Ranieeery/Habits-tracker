import type { CalendarDate } from "@habits/contracts";
import {
	addMonths,
	formatDayMonthYear,
	isMonthBefore,
	monthGrid,
	monthOf,
	monthTitle,
	WEEKDAY_SHORT_NAMES,
} from "@habits/core";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { IconButton } from "./button.tsx";
import { FieldError } from "./text-field.tsx";

/**
 * Inline month calendar (no native picker: 2.2.0 needs no new build). Dates
 * before `min` are disabled; each day is a 44 dp target with its full date
 * as the accessibility label.
 */
export function DatePicker({
	label,
	value,
	min,
	error,
	onChange,
}: {
	label: string;
	value: CalendarDate | "";
	min: CalendarDate;
	error?: string;
	onChange: (date: CalendarDate) => void;
}) {
	const [shown, setShown] = useState(() => monthOf(value || min));
	const previous = addMonths(shown, -1);
	const weeks = monthGrid(shown);

	return (
		<View className="gap-2">
			<Text className="text-sm font-semibold text-night-foreground">
				{label}
				{value ? `: ${formatDayMonthYear(value)}` : ""}
			</Text>
			<View className="gap-1 rounded-xl border border-night-border bg-night-surface p-2">
				<View className="flex-row items-center justify-between">
					<IconButton
						icon="chevron-left"
						label="Mês anterior"
						disabled={isMonthBefore(previous, min)}
						onPress={() => setShown(previous)}
					/>
					<Text
						accessibilityRole="header"
						accessibilityLiveRegion="polite"
						className="text-base font-semibold text-night-foreground"
					>
						{monthTitle(shown)}
					</Text>
					<IconButton
						icon="chevron-right"
						label="Próximo mês"
						onPress={() => setShown(addMonths(shown, 1))}
					/>
				</View>
				<View
					className="flex-row"
					importantForAccessibility="no-hide-descendants"
				>
					{WEEKDAY_SHORT_NAMES.map((name) => (
						<Text
							key={name}
							className="flex-1 text-center text-xs font-semibold text-night-muted"
						>
							{name.charAt(0).toUpperCase()}
						</Text>
					))}
				</View>
				{weeks.map((week, index) => (
					<View key={index} className="flex-row">
						{week.map((date, day) =>
							date === null ? (
								<View key={day} className="min-h-touch flex-1" />
							) : (
								<DayCell
									key={date}
									date={date}
									selected={date === value}
									disabled={date < min}
									onPress={() => onChange(date)}
								/>
							)
						)}
					</View>
				))}
			</View>
			<FieldError>{error}</FieldError>
		</View>
	);
}

function DayCell({
	date,
	selected,
	disabled,
	onPress,
}: {
	date: CalendarDate;
	selected: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={formatDayMonthYear(date)}
			accessibilityState={{ selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			className={`min-h-touch flex-1 items-center justify-center rounded-md ${selected ? "bg-night-accent" : "active:bg-night-surface-raised"} ${disabled ? "opacity-30" : ""}`}
		>
			<Text
				className={`text-base ${selected ? "font-bold text-night-accent-on" : "text-night-foreground"}`}
			>
				{Number(date.slice(8))}
			</Text>
		</Pressable>
	);
}
