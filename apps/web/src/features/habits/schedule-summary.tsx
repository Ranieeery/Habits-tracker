import type { CalendarDate, Habit } from "@habits/contracts";
import { isSupportedSchedule } from "@habits/contracts";
import {
	formatRelativeDate,
	formatSchedule,
	parseCalendarDate,
	WEEKDAY_SHORT_NAMES,
	weekdayOf,
} from "@habits/core";
import {
	CalendarDaysIcon,
	CalendarHeartIcon,
	CalendarRangeIcon,
	type LucideIcon,
	PinIcon,
	RepeatIcon,
} from "lucide-react";
import { monthShortName, weekdayInitial } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

// When a habit happens, shared by the habit cards and "Próximos".

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const TYPE_ICONS: Record<string, LucideIcon> = {
	interval: RepeatIcon,
	monthly_days: CalendarDaysIcon,
	once: PinIcon,
	yearly: CalendarHeartIcon,
	deadline: CalendarRangeIcon,
};

/**
 * When the habit happens. Weekday habits show the week (D S T Q Q S S) with
 * their days lit and today marked; other kinds show their icon and summary.
 * Read as one sentence ("Repete: seg, qua, sex"); the pills are decorative.
 */
export function ScheduleStrip({
	habit,
	today,
	muted,
}: {
	habit: Habit;
	today: CalendarDate;
	muted: boolean;
}) {
	const { schedule } = habit;
	const text = formatSchedule(schedule, { today });
	if (isSupportedSchedule(schedule) && schedule.type === "weekdays") {
		const todayWeekday = weekdayOf(today);
		return (
			<p className="flex items-center gap-1">
				<span className="sr-only">Repete: {text}</span>
				{WEEKDAYS.map((day) => {
					const on = schedule.days.includes(day);
					return (
						<span
							key={day}
							aria-hidden="true"
							data-on={on ? "" : undefined}
							data-today={day === todayWeekday ? "" : undefined}
							className={cn(
								"relative flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
								on
									? muted
										? "bg-night-surface-overlay text-night-foreground"
										: "bg-night-accent text-night-accent-on"
									: "text-night-subtle inset-ring inset-ring-night-border",
								day === todayWeekday &&
									"after:absolute after:-bottom-1.5 after:size-1 after:rounded-full after:bg-night-accent-text"
							)}
						>
							{weekdayInitial(day)}
						</span>
					);
				})}
			</p>
		);
	}
	const Icon = TYPE_ICONS[schedule.type];
	return (
		<p className="flex items-center gap-2 text-sm text-night-muted">
			{Icon && (
				<Icon
					className={cn(
						"size-4 shrink-0",
						muted ? "text-night-subtle" : "text-night-accent-text"
					)}
					aria-hidden="true"
				/>
			)}
			{text}
		</p>
	);
}

/**
 * A date as a small calendar block: weekday (or "amanhã") on top, the day
 * large, the month below. Decorative: the card says the date in words.
 */
export function DateChip({
	date,
	today,
}: {
	date: CalendarDate;
	today: CalendarDate;
}) {
	const { day, month } = parseCalendarDate(date);
	const tomorrow = formatRelativeDate(date, today) === "amanhã";
	return (
		<span
			aria-hidden="true"
			className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-night-bg py-1.5 leading-none inset-ring inset-ring-night-border"
		>
			<span
				className={cn(
					"text-[11px] font-semibold",
					tomorrow ? "text-night-accent-text" : "text-night-muted"
				)}
			>
				{tomorrow ? "amanhã" : WEEKDAY_SHORT_NAMES[weekdayOf(date)]}
			</span>
			<span className="font-display text-2xl font-bold tabular-nums">
				{day}
			</span>
			<span className="text-[11px] text-night-subtle">
				{monthShortName(month)}
			</span>
		</span>
	);
}
