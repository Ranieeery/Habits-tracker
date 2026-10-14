import type { CalendarDate } from "@habits/contracts";
import {
	dayItems,
	descriptionFirstLine,
	hasDescription,
	type PreviewItem,
	previewDayView,
	previewItems,
	rescheduleAvailability,
	rescheduledLabel,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarArrowUpIcon,
	CalendarRange,
	CircleDashed,
	EyeIcon,
} from "lucide-react";
import { useMemo } from "react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DescriptionPopover } from "@/features/habits/description-popover.tsx";
import { EditHabitDialog } from "@/features/habits/edit-habit-dialog.tsx";
import { formatLongDate, formatShortDate } from "@/lib/format.ts";
import { deadlineFirstsQuery, habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useScheduleOptions } from "@/lib/use-schedule-options.ts";
import { useToday } from "@/lib/use-today.ts";
import {
	type HabitActionHandler,
	HabitActionsButton,
	HabitRowMenu,
	type RescheduleMenu,
} from "./habit-actions-menu.tsx";
import { MovedOutNotes } from "./moved-out-notes.tsx";
import { RescheduleDialog } from "./reschedule-dialog.tsx";
import { useHabitActions } from "./use-habit-actions.ts";

/**
 * A day of the heatmap's preview (2.14.0, today + 1 to today + 7): what is
 * planned for it, read only (no checkbox, nothing to create or undo). Built
 * here from the habits already loaded, each deadline task's first completion
 * and (2.16.0) the postponed occurrences, with core's `dayView` (the day
 * detail's own function), only when the day is opened. 2.16.0: a postponed
 * occurrence shows "Adiado de 20/10", one that left this day a note "Adiado
 * para", and every row has the actions menu (2.16.1; before, only the rows
 * whose occurrence can move), with "Adiar" where it applies and no
 * archiving (that stays on today and past days).
 */
export function FutureDayView({ date }: { date: CalendarDate }) {
	const { api } = useServices();
	const today = useToday();
	const schedule = useScheduleOptions();
	const habits = useQuery(habitsQuery(api));
	const firsts = useQuery(deadlineFirstsQuery(api));
	const view = useMemo(() => {
		if (!habits.data || !firsts.data || !schedule.ready) return null;
		const day = previewDayView(
			habits.data,
			firsts.data,
			date,
			schedule.options
		);
		return { items: previewItems(day), movedOut: dayItems(day).movedOut };
	}, [habits.data, firsts.data, date, schedule.ready, schedule.options]);
	const menu = useHabitActions();
	const failed = habits.isError
		? { error: habits.error, retry: habits.refetch }
		: firsts.isError
			? { error: firsts.error, retry: firsts.refetch }
			: schedule.error
				? { error: schedule.error, retry: schedule.refetch }
				: null;

	const [weekday = "", ...rest] = formatLongDate(date).split(", ");

	return (
		<section
			aria-labelledby="day-title"
			className="mx-auto flex w-full max-w-2xl flex-col gap-6"
		>
			<header className="flex flex-col gap-1">
				<p className="font-semibold text-night-muted first-letter:uppercase">
					{rest.join(", ")}
				</p>
				<h1
					id="day-title"
					className="font-display text-4xl font-bold tracking-tight first-letter:uppercase"
				>
					{weekday}{" "}
					<span className="text-night-subtle tabular-nums">
						{formatShortDate(date)}
					</span>
				</h1>
			</header>

			<p className="flex items-center gap-2 text-sm text-night-muted">
				<EyeIcon className="size-4" aria-hidden="true" />
				Dia futuro, somente leitura
			</p>

			{failed ? (
				<ErrorState error={failed.error} onRetry={() => failed.retry()} />
			) : view === null ? (
				<div className="flex flex-col gap-3" aria-busy="true">
					<span className="sr-only">Carregando…</span>
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : view.items.length === 0 ? (
				<EmptyState
					title="Nada programado para este dia"
					description="Hábitos aparecem nos dias em que se repetem."
				/>
			) : (
				<ul
					aria-label="Programado para este dia"
					className="-mx-2 flex flex-col"
				>
					{view.items.map((item) => (
						<PreviewRow
							key={item.habit.id}
							item={item}
							date={date}
							today={today}
							onAction={menu.onAction}
						/>
					))}
				</ul>
			)}

			{view && <MovedOutNotes items={view.movedOut} today={today} />}

			{menu.editing && (
				<EditHabitDialog
					habit={menu.editing}
					open={menu.open}
					onOpenChange={menu.setOpen}
				/>
			)}
			{menu.postponing && (
				<RescheduleDialog
					habit={menu.postponing.habit}
					occurrence={menu.postponing.occurrence}
					open={menu.postponeOpen}
					onOpenChange={menu.setPostponeOpen}
				/>
			)}
		</section>
	);
}

/**
 * One planned habit: its name, the description's first line, no checkbox;
 * the actions menu ("Adiar" where it applies, shown or disabled with its
 * reason).
 */
function PreviewRow({
	item: { habit, dueOnDay, rescheduledFrom, rescheduleCount = 0 },
	date,
	today,
	onAction,
}: {
	item: PreviewItem;
	date: CalendarDate;
	today: CalendarDate;
	onAction: HabitActionHandler;
}) {
	const firstLine = descriptionFirstLine(habit.description);
	const moved =
		rescheduledFrom === undefined
			? null
			: rescheduledLabel(rescheduledFrom, today);
	const reschedule: RescheduleMenu = {
		availability: rescheduleAvailability(habit, {
			date,
			today,
			overdue: false,
			done: false,
			rescheduledFrom: rescheduledFrom ?? null,
			count: rescheduleCount,
		}),
		occurrence: {
			original: rescheduledFrom ?? date,
			effective: date,
			count: rescheduleCount,
		},
		archive: false,
	};
	const row = (
		<li className="flex items-center gap-1">
			<div className="flex min-h-touch min-w-0 flex-1 items-center gap-3 px-2 py-1.5">
				<CircleDashed
					className="size-5 shrink-0 text-night-subtle"
					aria-hidden="true"
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<span className="min-w-0 font-medium break-words">
							{habit.name}
							{dueOnDay && <span className="sr-only">, vence neste dia</span>}
							{moved && <span className="sr-only">, {moved.spoken}</span>}
						</span>
						{dueOnDay && (
							<span
								aria-hidden="true"
								className="inline-flex items-center gap-1 rounded-md border border-night-accent/40 bg-night-accent/15 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-night-accent-text"
							>
								<CalendarRange className="size-3.5 shrink-0" />
								Vence neste dia
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
					</span>
					{firstLine && (
						<span className="truncate text-sm text-night-muted">
							{firstLine}
						</span>
					)}
				</span>
			</div>
			{hasDescription(habit) && <DescriptionPopover habit={habit} />}
			<HabitActionsButton
				habit={habit}
				reschedule={reschedule}
				onAction={onAction}
			/>
		</li>
	);
	return (
		<HabitRowMenu habit={habit} reschedule={reschedule} onAction={onAction}>
			{row}
		</HabitRowMenu>
	);
}
