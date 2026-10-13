import {
	type CalendarDate,
	type Habit,
	isSupportedSchedule,
} from "@habits/contracts";
import { formatRelativeDate, nextOccurrence } from "@habits/core";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils.ts";
import { ScheduleStrip } from "./schedule-summary.tsx";

/** "Hoje" when it happens today, otherwise when it happens next. */
export function NextBadge({
	habit,
	today,
	timeZone,
}: {
	habit: Habit;
	today: CalendarDate;
	timeZone: string;
}) {
	if (habit.archived_at !== null) return null;
	const next = nextOccurrence(habit, today, { timeZone });
	if (next === null) return null;
	if (next === today) {
		return (
			<span className="rounded-full bg-night-success-surface px-2 py-0.5 text-xs font-semibold text-night-success">
				Hoje
			</span>
		);
	}
	return (
		<span className="rounded-full border border-night-border px-2 py-0.5 text-xs text-night-muted">
			Próxima: {formatRelativeDate(next, today)}
		</span>
	);
}

export interface HabitCardProps {
	habit: Habit;
	today: CalendarDate;
	timeZone: string;
	/** Past single dates and archived habits. */
	muted?: boolean;
	/** The drag handle (reorderable lists only). */
	handle?: ReactNode;
	actions: ReactNode;
	ref?: Ref<HTMLLIElement>;
	style?: CSSProperties;
	className?: string;
}

/** One habit in the habits screen: name, when it happens, and its actions. */
export function HabitCard({
	habit,
	today,
	timeZone,
	muted = false,
	handle,
	actions,
	ref,
	style,
	className,
}: HabitCardProps) {
	const supported = isSupportedSchedule(habit.schedule);
	return (
		<li
			ref={ref}
			style={style}
			data-habit-id={habit.id}
			className={cn(
				"flex items-center gap-2 rounded-xl border border-night-border bg-night-surface py-3 pr-2 transition-colors hover:border-night-border-strong",
				handle ? "pl-1" : "pl-4",
				className
			)}
		>
			{handle}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span
						className={cn(
							"min-w-0 break-words",
							muted ? "text-night-muted" : "font-semibold"
						)}
					>
						{habit.name}
					</span>
					{supported && !muted && (
						<NextBadge habit={habit} today={today} timeZone={timeZone} />
					)}
				</div>
				{supported ? (
					<ScheduleStrip habit={habit} today={today} muted={muted} />
				) : (
					<p className="flex flex-wrap items-center gap-2 text-xs text-night-muted">
						<span className="rounded-sm border border-night-danger px-1 font-semibold text-night-danger">
							Incompatível
						</span>
						Atualize o app para ver a repetição.
					</p>
				)}
			</div>
			<div className="flex shrink-0 items-center">{actions}</div>
		</li>
	);
}
