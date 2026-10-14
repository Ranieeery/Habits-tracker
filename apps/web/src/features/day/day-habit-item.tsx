import type { CalendarDate, Habit } from "@habits/contracts";
import {
	ARCHIVED_BADGE,
	type DayItem,
	deadlineDoneLabel,
	deadlineLabel,
	descriptionFirstLine,
	hasDescription,
	overdueLabel,
	rescheduleAvailability,
	rescheduledLabel,
} from "@habits/core";
import {
	ArchiveIcon,
	CalendarArrowUpIcon,
	CalendarClock,
	CalendarRange,
} from "lucide-react";
import { memo, useId, useMemo, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { DescriptionPopover } from "@/features/habits/description-popover.tsx";
import { pulse, release } from "@/features/heatmap/pulse.ts";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion.ts";
import { cn } from "@/lib/utils.ts";
import {
	type HabitActionHandler,
	HabitActionsButton,
	HabitRowMenu,
	type RescheduleMenu,
} from "./habit-actions-menu.tsx";

/**
 * One habit of a day with its checkbox: the whole row is the target (44px+).
 * Shared by the day view and the heatmap's "Hoje" panel. Checking pulses the
 * box and unchecking dips it (both skipped with reduced motion). An overdue
 * habit (2.8.0) carries the "Atrasado desde 11/10" badge (icon and text,
 * never color alone), read as "Nome, atrasado desde 11 de outubro".
 * 2.15.0: with `onAction` (only on the Hoje tab, `/today`), the actions
 * menu, from the always visible "more options" button at the end and from a
 * right click inside the row; elsewhere (the history: the heatmap's panel
 * and days opened from it) neither. Also the "Arquivado" badge of a habit
 * archived today or later that a day still lists. Memoized: it takes the
 * item from `dayItems` (memoized by the day) and stable handlers, and
 * builds its labels itself. 2.16.0: a postponed occurrence living on this
 * day carries "Adiado de 20/10" (icon and text; an overdue one keeps
 * "Atrasado desde" with a discreet "· adiado"), and the menu offers "Adiar"
 * as core's `rescheduleAvailability` says.
 */
export const DayHabitItem = memo(function DayHabitItem({
	item,
	date,
	today,
	editable,
	onToggle,
	onAction,
}: {
	item: DayItem;
	date: CalendarDate;
	/** The user's today (for "Adiar" and the badges' years). */
	today: CalendarDate;
	editable: boolean;
	onToggle: (habit: Habit, completed: boolean) => void;
	/** The actions menu (only on the Hoje tab); absent elsewhere. */
	onAction?: HabitActionHandler;
}) {
	const { habit, done: completed } = item;
	const overdue =
		item.overdueSince === null
			? null
			: overdueLabel(item.overdueSince, date, item.rescheduledFrom ?? null);
	// 2.16.0: "Adiado de 20/10" (an overdue one says it in its own badge).
	const moved =
		item.rescheduledFrom !== undefined && overdue === null
			? rescheduledLabel(item.rescheduledFrom, today)
			: null;
	const reschedule = useMemo(
		(): RescheduleMenu => ({
			availability: rescheduleAvailability(item.habit, {
				date,
				today,
				overdue: item.overdueSince !== null,
				done: item.done,
				rescheduledFrom: item.rescheduledFrom ?? null,
				count: item.rescheduleCount ?? 0,
			}),
			occurrence: {
				original: item.rescheduledFrom ?? date,
				effective: date,
				count: item.rescheduleCount ?? 0,
			},
		}),
		[item, date, today]
	);
	// An open deadline task (2.13.0): "Até 20/10 · faltam 7 dias".
	const due = item.dueDate === null ? null : deadlineLabel(item.dueDate, date);
	// A deadline task first completed on another day (2.13.0): "Já concluída
	// em 22/10", shown checked and disabled (no second completion).
	const doneOn =
		item.completedOn === null
			? null
			: deadlineDoneLabel(item.completedOn, date);
	const id = useId();
	const lineId = useId();
	// 2.12.0: the description's first line under the name.
	const firstLine = descriptionFirstLine(habit.description);
	const box = useRef<HTMLButtonElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	const archived = habit.archived_at !== null;

	const row = (
		<li className="flex items-center gap-1">
			<label
				htmlFor={id}
				className={cn(
					"flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 motion-safe:transition-colors motion-safe:duration-150",
					editable
						? "cursor-pointer hover:bg-night-surface-raised"
						: "cursor-default"
				)}
			>
				<Checkbox
					ref={box}
					id={id}
					// Explicit: a hidden text inside the label would be read with a
					// space before the comma ("Nome , atrasado…").
					// The description line is not part of the name: it describes it.
					aria-label={[
						habit.name,
						overdue?.spoken,
						due?.spoken,
						moved?.spoken,
						doneOn?.spoken,
						archived && "arquivado",
					]
						.filter(Boolean)
						.join(", ")}
					aria-describedby={firstLine ? lineId : undefined}
					checked={completed || doneOn !== null}
					disabled={!editable || doneOn !== null}
					onCheckedChange={(checked) => {
						const value = checked === true;
						if (!reducedMotion) (value ? pulse : release)(box.current);
						onToggle(habit, value);
					}}
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<span
							className={cn(
								"min-w-0 font-medium break-words motion-safe:transition-colors motion-safe:duration-150",
								completed && "text-night-muted line-through"
							)}
						>
							{habit.name}
						</span>
						{overdue && (
							<span
								aria-hidden="true"
								className="inline-flex items-center gap-1 rounded-md border border-night-warning/60 bg-night-warning-surface px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-night-warning"
							>
								<CalendarClock className="size-3.5 shrink-0" />
								{overdue.text}
							</span>
						)}
						{due && (
							<span
								aria-hidden="true"
								className={cn(
									"inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
									due.dueToday
										? "border-night-warning/60 bg-night-warning-surface text-night-warning"
										: "border-night-accent/40 bg-night-accent/15 text-night-accent-text"
								)}
							>
								<CalendarRange className="size-3.5 shrink-0" />
								{due.text}
							</span>
						)}
						{moved && (
							<span
								aria-hidden="true"
								className="inline-flex items-center gap-1 rounded-md border border-night-border-strong px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-night-muted"
							>
								<CalendarArrowUpIcon className="size-3.5 shrink-0" />
								{moved.text}
							</span>
						)}
						{archived && (
							<span
								aria-hidden="true"
								className="inline-flex items-center gap-1 rounded-md border border-night-border-strong px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-night-muted"
							>
								<ArchiveIcon className="size-3.5 shrink-0" />
								{ARCHIVED_BADGE}
							</span>
						)}
						{doneOn && (
							<span aria-hidden="true" className="text-xs text-night-muted">
								{doneOn.text}
							</span>
						)}
					</span>
					{firstLine && (
						<span
							id={lineId}
							className={cn(
								"truncate text-sm text-night-muted motion-safe:transition-opacity motion-safe:duration-150",
								completed && "opacity-70"
							)}
						>
							{firstLine}
						</span>
					)}
				</span>
			</label>
			{/* Its own target, outside the label: marking stays a click on the row. */}
			{hasDescription(habit) && <DescriptionPopover habit={habit} />}
			{onAction && (
				<HabitActionsButton
					habit={habit}
					reschedule={reschedule}
					onAction={onAction}
				/>
			)}
		</li>
	);
	return onAction ? (
		<HabitRowMenu habit={habit} reschedule={reschedule} onAction={onAction}>
			{row}
		</HabitRowMenu>
	) : (
		row
	);
});
