import type { CalendarDate } from "@habits/contracts";
import { completionRatio } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	formatLongDate,
	formatPercent,
	formatShortDate,
} from "@/lib/format.ts";
import { dayQuery, habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { DayHabitItem } from "./day-habit-item.tsx";
import { NewHabitDialog } from "./new-habit-dialog.tsx";
import { UpcomingSection } from "./upcoming-section.tsx";
import { useToggleCompletion } from "./use-toggle-completion.ts";

/**
 * The habits possible on `date` and their completion. Only today can be
 * edited, like the legacy app; other days are read-only. Today also offers
 * "Novo hábito": in the header, or as the empty state's action.
 */
export function DayView({
	date,
	today,
}: {
	date: CalendarDate;
	today: CalendarDate;
}) {
	const { api } = useServices();
	const day = useQuery(dayQuery(api, date));
	const toggle = useToggleCompletion(date);
	const editable = date === today;
	const hasHabits = (day.data?.possible_habits.length ?? 0) > 0;

	const [weekday = "", ...rest] = formatLongDate(date).split(", ");

	return (
		<section aria-labelledby="day-title" className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					<p className="font-semibold text-muted capitalize">
						{editable ? "Hoje" : rest.join(", ")}
					</p>
					<h1 id="day-title" className="text-3xl font-extrabold capitalize">
						{weekday}{" "}
						<span className="text-muted">{formatShortDate(date)}</span>
					</h1>
				</div>
				{editable && hasHabits && <NewHabitDialog today={today} />}
			</header>

			{day.isPending ? (
				<div className="flex flex-col gap-3" aria-busy="true">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : day.isError ? (
				<ErrorState error={day.error} onRetry={() => day.refetch()} />
			) : day.data.possible_habits.length === 0 && editable ? (
				<TodayEmptyState today={today} />
			) : day.data.possible_habits.length === 0 ? (
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
					possible={day.data.possible_habits}
					completedIds={new Set(day.data.completed_habit_ids)}
					editable={editable}
					onToggle={(habitId, completed) =>
						toggle.mutate({ habitId, completed })
					}
				/>
			)}

			{editable && <UpcomingSection today={today} />}
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
	possible,
	completedIds,
	editable,
	onToggle,
}: {
	possible: { id: string; name: string }[];
	completedIds: Set<string>;
	editable: boolean;
	onToggle: (habitId: string, completed: boolean) => void;
}) {
	const completed = possible.filter((habit) => completedIds.has(habit.id));
	const ratio = completionRatio(completed.length, possible.length);

	return (
		<>
			<div className="flex flex-col gap-2">
				<Progress
					value={ratio * 100}
					aria-label="Progresso do dia"
					aria-valuetext={`${completed.length} de ${possible.length} hábitos concluídos`}
				/>
				<p className="text-sm text-muted">
					{completed.length} de {possible.length} concluídos (
					{formatPercent(ratio)})
				</p>
			</div>

			{!editable && (
				<p className="flex items-center gap-2 text-sm text-muted">
					<LockIcon className="size-4" aria-hidden="true" />
					Somente leitura: só é possível marcar os hábitos de hoje.
				</p>
			)}

			<ul className="flex flex-col gap-1">
				{possible.map((habit) => (
					<DayHabitItem
						key={habit.id}
						habit={habit}
						completed={completedIds.has(habit.id)}
						editable={editable}
						onToggle={(value) => onToggle(habit.id, value)}
					/>
				))}
			</ul>
		</>
	);
}
