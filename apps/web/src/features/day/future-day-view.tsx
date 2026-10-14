import type { CalendarDate } from "@habits/contracts";
import {
	descriptionFirstLine,
	hasDescription,
	type PreviewItem,
	previewDayView,
	previewItems,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, CircleDashed, EyeIcon } from "lucide-react";
import { useMemo } from "react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DescriptionPopover } from "@/features/habits/description-popover.tsx";
import { formatLongDate, formatShortDate } from "@/lib/format.ts";
import { deadlineFirstsQuery, habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";

/**
 * A day of the heatmap's preview (2.14.0, today + 1 to today + 7): what is
 * planned for it, read only (no checkbox, nothing to create, edit or undo).
 * Built here from the habits already loaded and each deadline task's first
 * completion, with core's `dayView` (the day detail's own function), only
 * when the day is opened: no request of its own.
 */
export function FutureDayView({ date }: { date: CalendarDate }) {
	const { api } = useServices();
	const timeZone = useUserTimeZone();
	const habits = useQuery(habitsQuery(api));
	const firsts = useQuery(deadlineFirstsQuery(api));
	const items = useMemo(
		() =>
			habits.data && firsts.data
				? previewItems(
						previewDayView(habits.data, firsts.data, date, { timeZone })
					)
				: null,
		[habits.data, firsts.data, date, timeZone]
	);
	const failed = habits.isError ? habits : firsts.isError ? firsts : null;

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
				<ErrorState error={failed.error} onRetry={() => failed.refetch()} />
			) : items === null ? (
				<div className="flex flex-col gap-3" aria-busy="true">
					<span className="sr-only">Carregando…</span>
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : items.length === 0 ? (
				<EmptyState
					title="Nada programado para este dia"
					description="Hábitos aparecem nos dias em que se repetem."
				/>
			) : (
				<ul
					aria-label="Programado para este dia"
					className="-mx-2 flex flex-col"
				>
					{items.map((item) => (
						<PreviewRow key={item.habit.id} item={item} />
					))}
				</ul>
			)}
		</section>
	);
}

/** One planned habit: its name, the description's first line, no checkbox. */
function PreviewRow({ item: { habit, dueOnDay } }: { item: PreviewItem }) {
	const firstLine = descriptionFirstLine(habit.description);
	return (
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
					</span>
					{firstLine && (
						<span className="truncate text-sm text-night-muted">
							{firstLine}
						</span>
					)}
				</span>
			</div>
			{hasDescription(habit) && <DescriptionPopover habit={habit} />}
		</li>
	);
}
