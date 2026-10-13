import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
	type CalendarDate,
	type Habit,
	isSupportedSchedule,
} from "@habits/contracts";
import {
	formatRelativeDate,
	formatSchedule,
	nextOccurrence,
	weekdayOf,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { PressableScale } from "@/ui/pressable-scale.tsx";
import { weekdayInitial } from "@/lib/format.ts";
import type { IconName } from "@/ui/button.tsx";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const TYPE_ICONS: Record<string, IconName> = {
	interval: "repeat",
	monthly_days: "calendar-month-outline",
	once: "pin-outline",
	yearly: "calendar-heart",
};

/**
 * When the habit happens (DESIGN.md "Cartão de hábito", like the web):
 * weekday habits show D S T Q Q S S with their days lit and a dot under
 * today; other kinds show their icon and summary. Decorative: the card reads
 * the schedule as a sentence.
 */
function ScheduleStrip({
	habit,
	today,
	muted,
}: {
	habit: Habit;
	today: CalendarDate;
	muted: boolean;
}) {
	const { schedule } = habit;
	if (!isSupportedSchedule(schedule)) {
		return (
			<View className="flex-row flex-wrap items-center gap-2">
				<Text className="rounded-sm border border-night-danger px-1 text-xs font-semibold text-night-danger">
					Incompatível
				</Text>
				<Text className="text-xs text-night-muted">
					Atualize o app para ver a repetição.
				</Text>
			</View>
		);
	}
	if (schedule.type === "weekdays") {
		const todayWeekday = weekdayOf(today);
		return (
			<View className="flex-row gap-1">
				{WEEKDAYS.map((day) => {
					const on = schedule.days.includes(day);
					return (
						<View key={day} className="items-center gap-0.5">
							<View
								className={`size-6 items-center justify-center rounded-full ${on ? (muted ? "bg-night-surface-overlay" : "bg-night-accent") : "border border-night-border"}`}
							>
								<Text
									maxFontSizeMultiplier={1.2}
									className={`text-[11px] font-bold ${on ? (muted ? "text-night-foreground" : "text-night-accent-on") : "text-night-subtle"}`}
								>
									{weekdayInitial(day)}
								</Text>
							</View>
							<View
								className={`size-1 rounded-full ${day === todayWeekday ? "bg-night-accent-text" : ""}`}
							/>
						</View>
					);
				})}
			</View>
		);
	}
	return (
		<View className="flex-row items-center gap-2">
			<MaterialCommunityIcons
				name={TYPE_ICONS[schedule.type] ?? "calendar"}
				size={16}
				color={muted ? nightColors.subtle : nightColors.accent.text}
			/>
			<Text className="flex-1 text-sm text-night-muted">
				{formatSchedule(schedule, { today })}
			</Text>
		</View>
	);
}

/** "Hoje" when it happens today, otherwise when it happens next. */
function nextBadge(habit: Habit, today: CalendarDate, timeZone: string) {
	if (habit.archived_at !== null) return null;
	const next = nextOccurrence(habit, today, { timeZone });
	if (next === null) return null;
	return next === today
		? { today: true, text: "Hoje" }
		: { today: false, text: `Próxima: ${formatRelativeDate(next, today)}` };
}

/**
 * One habit on the Hábitos tab: name, a "Hoje"/"Próxima" badge and when it
 * happens. The whole card opens the habit; in reorder mode `actions` (up and
 * down) replace that and the card itself is inert.
 */
export function HabitCard({
	habit,
	today,
	timeZone,
	muted = false,
	actions,
	onPress,
}: {
	habit: Habit;
	today: CalendarDate;
	timeZone: string;
	/** Past single dates and archived habits. */
	muted?: boolean;
	actions?: ReactNode;
	onPress?: () => void;
}) {
	const supported = isSupportedSchedule(habit.schedule);
	const badge = supported && !muted ? nextBadge(habit, today, timeZone) : null;
	const scheduleText = supported
		? formatSchedule(habit.schedule, { today })
		: "incompatível com esta versão";
	const label = `${habit.name}${badge ? `, ${badge.text}` : ""}, repete: ${scheduleText}`;

	return (
		<View className="flex-row items-center rounded-xl border border-night-border bg-night-surface">
			<PressableScale
				accessibilityRole={onPress ? "button" : undefined}
				accessibilityLabel={label}
				accessibilityHint={onPress ? "Abre para editar ou arquivar" : undefined}
				disabled={!onPress}
				onPress={onPress}
				outerStyle={{ flex: 1 }}
				className="min-h-14 gap-2 rounded-xl py-3 pl-4 pr-2 active:bg-night-surface-raised"
			>
				<View importantForAccessibility="no-hide-descendants" className="gap-2">
					<View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
						<Text
							className={`text-base ${muted ? "text-night-muted" : "font-semibold text-night-foreground"}`}
						>
							{habit.name}
						</Text>
						{badge ? (
							<Text
								className={`rounded-full px-2 py-0.5 text-xs ${badge.today ? "bg-night-success-surface font-semibold text-night-success" : "border border-night-border text-night-muted"}`}
							>
								{badge.text}
							</Text>
						) : null}
					</View>
					<ScheduleStrip habit={habit} today={today} muted={muted} />
				</View>
			</PressableScale>
			{actions ??
				(onPress ? (
					<View className="pr-3">
						<MaterialCommunityIcons
							name="chevron-right"
							size={24}
							color={nightColors.muted}
						/>
					</View>
				) : null)}
		</View>
	);
}
