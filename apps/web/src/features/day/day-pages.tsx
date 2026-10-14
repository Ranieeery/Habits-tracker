import type { CalendarDate } from "@habits/contracts";
import {
	addDays,
	compareDates,
	firstDayOfYear,
	heatmapYearRange,
	isPreviewDate,
	PREVIEW_DAYS,
	previewEnd,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/states.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { formatLongDate } from "@/lib/format.ts";
import { habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";
import { DayView } from "./day-view.tsx";
import { FutureDayView } from "./future-day-view.tsx";
import { useDayShortcuts } from "./use-day-shortcuts.ts";

/** Always shows the user's current day, and follows it when the date turns. */
export function TodayPage() {
	const today = useToday();
	return <DayView date={today} today={today} />;
}

/**
 * A specific day, opened from the heatmap. Keyed by date: another day starts
 * locked again (the past-day unlock is state of one visit only).
 * "Voltar ao histórico" (also Esc) returns to the heatmap; the arrows (also
 * ←/→) step to the neighbor days, from January 1 of the heatmap's first year
 * up to the last preview day (today + PREVIEW_DAYS, 2.14.0, read only).
 * Steps replace the history entry, so Back still returns to where the day
 * was opened from. A later date says it is too far instead of a day.
 */
export function DayPage({ date }: { date: CalendarDate }) {
	const today = useToday();
	const navigate = useNavigate();
	const { api } = useServices();
	const habits = useQuery(habitsQuery(api));
	const earliest = firstDayOfYear(
		heatmapYearRange(habits.data ?? [], today).first
	);
	// 2.14.0: the next PREVIEW_DAYS can be opened (read only); later dates
	// cannot, from the heatmap, the arrows or a typed URL.
	const last = previewEnd(today);
	const tooFar = compareDates(date, last) > 0;
	const preview = isPreviewDate(date, today);
	const previous =
		compareDates(date, earliest) > 0 && !tooFar ? addDays(date, -1) : undefined;
	const next = compareDates(date, last) < 0 ? addDays(date, 1) : undefined;

	const goTo = (day: CalendarDate) =>
		void navigate({ to: "/day/$date", params: { date: day }, replace: true });

	useDayShortcuts({
		onEscape: () => void navigate({ to: "/" }),
		onPrevious: previous ? () => goTo(previous) : undefined,
		onNext: next ? () => goTo(next) : undefined,
	});

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
			<div className="flex items-center justify-between gap-2">
				<Link
					to="/"
					aria-keyshortcuts="Escape"
					className={buttonVariants({ variant: "ghost", className: "-ml-3" })}
				>
					<ArrowLeftIcon aria-hidden="true" />
					Voltar ao histórico
					<kbd
						aria-hidden="true"
						className="hidden rounded-sm border border-night-border-strong px-1.5 font-sans text-xs text-night-subtle md:inline"
					>
						Esc
					</kbd>
				</Link>
				<nav aria-label="Outros dias" className="flex items-center gap-1">
					<DayStep
						to={previous}
						label="Dia anterior"
						shortcut="ArrowLeft"
						icon={<ChevronLeftIcon aria-hidden="true" />}
					/>
					<DayStep
						to={next}
						label="Próximo dia"
						shortcut="ArrowRight"
						icon={<ChevronRightIcon aria-hidden="true" />}
					/>
				</nav>
			</div>
			{tooFar ? (
				<EmptyState
					title="Este dia ainda está longe"
					description={`Dá para ver só os próximos ${PREVIEW_DAYS} dias. Volte ao histórico e escolha outro dia.`}
					action={
						<Link to="/" className={buttonVariants({ variant: "outline" })}>
							Voltar ao histórico
						</Link>
					}
				/>
			) : preview ? (
				<FutureDayView key={date} date={date} />
			) : (
				<DayView key={date} date={date} today={today} />
			)}
		</div>
	);
}

/** One arrow: a link to the neighbor day, or a disabled button at the edge. */
function DayStep({
	to,
	label,
	shortcut,
	icon,
}: {
	to: CalendarDate | undefined;
	label: string;
	shortcut: string;
	icon: ReactNode;
}) {
	if (to === undefined) {
		return (
			<Button variant="ghost" size="icon" aria-label={label} disabled>
				{icon}
			</Button>
		);
	}
	const name = `${label}: ${formatLongDate(to)}`;
	return (
		<Link
			to="/day/$date"
			params={{ date: to }}
			replace
			aria-label={name}
			title={name}
			aria-keyshortcuts={shortcut}
			className={buttonVariants({ variant: "ghost", size: "icon" })}
		>
			{icon}
		</Link>
	);
}
