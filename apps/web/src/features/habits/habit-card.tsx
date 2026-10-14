import {
	type CalendarDate,
	type Habit,
	isSupportedSchedule,
} from "@habits/contracts";
import {
	deadlineLabel,
	deadlineOf,
	formatRelativeDate,
	nextOccurrence,
	overdueLabel,
} from "@habits/core";
import type { CSSProperties, ReactNode, Ref } from "react";
import { useScheduleOptions } from "@/lib/use-schedule-options.ts";
import { cn } from "@/lib/utils.ts";
import { ScheduleStrip } from "./schedule-summary.tsx";

/**
 * "Hoje" when it happens today, otherwise when it happens next (2.16.0: on
 * the effective date of a postponed occurrence).
 */
export function NextBadge({
	habit,
	today,
}: {
	habit: Habit;
	today: CalendarDate;
}) {
	const { options } = useScheduleOptions();
	if (habit.archived_at !== null) return null;
	// A task with a deadline (2.13.0): how long is left, or overdue.
	const deadline = deadlineOf(habit.schedule);
	if (deadline) {
		const label =
			deadline.due_date < today
				? {
						text: overdueLabel(deadline.due_date, today).text,
						dueToday: false,
						late: true,
					}
				: { ...deadlineLabel(deadline.due_date, today), late: false };
		return (
			<span
				className={cn(
					"rounded-full px-2 py-0.5 text-xs font-semibold",
					label.late || label.dueToday
						? "bg-night-warning-surface text-night-warning"
						: "bg-night-accent/15 text-night-accent-text"
				)}
			>
				{label.text}
			</span>
		);
	}
	const next = nextOccurrence(habit, today, options);
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
					{supported && !muted && <NextBadge habit={habit} today={today} />}
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
