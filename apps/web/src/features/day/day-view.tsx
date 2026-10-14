import type { CalendarDate } from "@habits/contracts";
import {
	extrasOnlyText,
	BACKFILL_DAYS,
	completionRatio,
	type DayItem,
	type DayProgress,
	getDayEditState,
	isDayEditable,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	formatLongDate,
	formatPercent,
	formatShortDate,
} from "@/lib/format.ts";
import { habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { DayItemsList } from "./day-items-list.tsx";
import { NewHabitDialog } from "./new-habit-dialog.tsx";
import { PastDayBar } from "./past-day-bar.tsx";
import { UpcomingSection } from "./upcoming-section.tsx";
import { useDayItems } from "./use-day-items.ts";

/**
 * The habits possible on `date` and their completion. Today is editable; a
 * past day inside the backfill window opens read-only and can be unlocked
 * with a confirmation ("Editar este dia"); older and future days stay
 * read-only (core's `getDayEditState`). The unlock is this component's
 * state only: `DayPage` keys it by date, so changing days or leaving the
 * screen locks the day again. Today also offers "Novo hábito": in the
 * header, or as the empty state's action, and lists the overdue fixed-day
 * habits first (2.8.0, `useDayItems`).
 */
export function DayView({
	date,
	today,
}: {
	date: CalendarDate;
	today: CalendarDate;
}) {
	const { day, view, toggle } = useDayItems(date);
	const editState = getDayEditState(date, today);
	const [unlocked, setUnlocked] = useState(false);
	const isToday = editState === "today";
	const editable = isDayEditable(editState, unlocked);
	const hasHabits = (view?.items.length ?? 0) > 0;

	const [weekday = "", ...rest] = formatLongDate(date).split(", ");

	return (
		<section
			aria-labelledby="day-title"
			className="mx-auto flex w-full max-w-2xl flex-col gap-6"
		>
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					{/* first-letter, not capitalize: "5 de outubro", never "5 De Outubro". */}
					<p className="font-semibold text-night-muted first-letter:uppercase">
						{isToday ? "Hoje" : rest.join(", ")}
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
				</div>
				{isToday && hasHabits && <NewHabitDialog today={today} />}
			</header>

			{day.isPending ? (
				<div className="flex flex-col gap-3" aria-busy="true">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : day.isError ? (
				<ErrorState error={day.error} onRetry={() => day.refetch()} />
			) : view === null ? null : view.items.length === 0 && isToday ? (
				<TodayEmptyState today={today} />
			) : view.items.length === 0 ? (
				<EmptyState
					title="Nenhum hábito para este dia"
					description="Hábitos aparecem nos dias em que se repetem."
					action={
						<Link
							to="/habits"
							className={buttonVariants({ variant: "outline" })}
						>
							Gerenciar hábitos
						</Link>
					}
				/>
			) : (
				<DayContent
					date={date}
					items={view.items}
					progress={view.progress}
					editable={editable}
					onToggle={(habit, completed) =>
						toggle.mutate({
							habitId: habit.id,
							habitName: habit.name,
							completed,
						})
					}
					bar={
						isToday ? null : (
							<PastDayBar
								date={date}
								state={editState}
								backfillDays={BACKFILL_DAYS}
								unlocked={unlocked}
								onUnlock={() => setUnlocked(true)}
								onLock={() => {
									toggle.dismissUndo();
									setUnlocked(false);
								}}
							/>
						)
					}
				/>
			)}

			{isToday && <UpcomingSection today={today} />}
		</section>
	);
}

/** Today without habits: creating one is the main action. */
function TodayEmptyState({ today }: { today: CalendarDate }) {
	const { api } = useServices();
	const habits = useQuery(habitsQuery(api));
	const hasActive = habits.data?.some((habit) => habit.archived_at === null);

	return (
		<EmptyState
			title={hasActive ? "Nenhum hábito para hoje" : "Nenhum hábito ainda"}
			description={
				hasActive
					? "Hábitos aparecem nos dias em que se repetem."
					: "Crie um hábito: ele começa a contar hoje."
			}
			action={
				<div className="flex flex-wrap justify-center gap-2">
					<NewHabitDialog today={today} />
					{hasActive && (
						<Link to="/habits" className={buttonVariants({ variant: "ghost" })}>
							Gerenciar hábitos
						</Link>
					)}
				</div>
			}
		/>
	);
}

function DayContent({
	date,
	items,
	progress,
	editable,
	onToggle,
	bar,
}: {
	date: CalendarDate;
	items: readonly DayItem[];
	progress: DayProgress;
	editable: boolean;
	onToggle: (habit: { id: string; name: string }, completed: boolean) => void;
	/** Read-only notice or past-day editing controls, above the list. */
	bar: ReactNode;
}) {
	const { completed, possible } = progress;
	const ratio = completionRatio(completed, possible);

	return (
		<>
			{possible === 0 ? (
				// Only overdue habits or deadline tasks not due: no "0 de 0" bar.
				<p className="text-sm text-night-muted">{extrasOnlyText(items)}</p>
			) : (
				<div className="flex flex-col gap-2">
					<Progress
						value={ratio * 100}
						aria-label="Progresso do dia"
						aria-valuetext={`${completed} de ${possible} hábitos concluídos`}
					/>
					<p className="text-sm text-night-muted tabular-nums">
						{completed} de {possible} concluídos ({formatPercent(ratio)})
					</p>
				</div>
			)}

			{bar}

			<DayItemsList
				date={date}
				items={items}
				editable={editable}
				onToggle={onToggle}
			/>
		</>
	);
}
