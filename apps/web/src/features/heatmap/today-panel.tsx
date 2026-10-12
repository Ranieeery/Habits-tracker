import type { CalendarDate } from "@habits/contracts";
import { completionRatio } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { buttonVariants } from "@/components/ui/button.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { formatLongDate } from "@/lib/format.ts";
import { dayQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { cn } from "@/lib/utils.ts";
import { DayHabitItem } from "@/features/day/day-habit-item.tsx";
import { useToggleCompletion } from "@/features/day/use-toggle-completion.ts";

/**
 * Today's habits next to the heatmap (below it on narrow screens), checked
 * with the day view's own mutation: optimistic, rolled back on failure, with
 * "Desfazer". Creating habits stays in the day view ("Abrir o dia").
 */
export function TodayPanel({ today }: { today: CalendarDate }) {
	const { api } = useServices();
	const day = useQuery(dayQuery(api, today));
	const toggle = useToggleCompletion(today);
	const titleId = useId();

	return (
		<section
			aria-labelledby={titleId}
			className="flex flex-col gap-4 rounded-xl border border-night-border bg-night-surface p-5"
		>
			<header className="flex flex-col gap-0.5">
				<h2 id={titleId} className="font-display text-xl font-bold">
					Hoje
				</h2>
				<p className="text-sm text-night-muted first-letter:uppercase">
					{formatLongDate(today)}
				</p>
			</header>

			{day.isPending ? (
				<div aria-busy="true" className="flex flex-col gap-2">
					<span className="sr-only">Carregando os hábitos de hoje…</span>
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							aria-hidden="true"
							className="h-touch rounded-lg bg-night-surface-raised"
						/>
					))}
				</div>
			) : day.isError ? (
				<div role="alert" className="flex flex-col gap-3 text-sm">
					<p className="text-night-danger">{errorMessage(day.error)}</p>
					<button
						type="button"
						onClick={() => day.refetch()}
						className={cn(
							buttonVariants({ variant: "secondary", size: "sm" }),
							"self-start"
						)}
					>
						Tentar de novo
					</button>
				</div>
			) : day.data.possible_habits.length === 0 ? (
				<p className="text-sm text-night-muted">
					Nenhum hábito previsto para hoje.
				</p>
			) : (
				<TodayList
					habits={day.data.possible_habits}
					completedIds={new Set(day.data.completed_habit_ids)}
					onToggle={(habit, completed) =>
						toggle.mutate({
							habitId: habit.id,
							habitName: habit.name,
							completed,
						})
					}
				/>
			)}

			<Link
				to="/today"
				className={cn(
					buttonVariants({ variant: "ghost" }),
					"-mx-2 self-start text-night-accent-text"
				)}
			>
				Abrir o dia
			</Link>
		</section>
	);
}

function TodayList({
	habits,
	completedIds,
	onToggle,
}: {
	habits: { id: string; name: string }[];
	completedIds: Set<string>;
	onToggle: (habit: { id: string; name: string }, completed: boolean) => void;
}) {
	const done = habits.filter((habit) => completedIds.has(habit.id)).length;
	const ratio = completionRatio(done, habits.length);

	return (
		<>
			<div className="flex flex-col gap-2">
				<p className="text-sm text-night-muted tabular-nums">
					{done} de {habits.length} concluídos
				</p>
				<div
					role="progressbar"
					aria-label="Progresso de hoje"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(ratio * 100)}
					aria-valuetext={`${done} de ${habits.length} hábitos concluídos`}
					className="h-1.5 overflow-hidden rounded-full bg-night-surface-raised"
				>
					<div
						className="h-full origin-left rounded-full bg-night-accent motion-safe:transition-transform motion-safe:duration-200"
						style={{ transform: `scaleX(${ratio})` }}
					/>
				</div>
			</div>
			<ul className="-mx-2 flex flex-col">
				{habits.map((habit) => (
					<DayHabitItem
						key={habit.id}
						habit={habit}
						completed={completedIds.has(habit.id)}
						editable
						onToggle={(completed) => onToggle(habit, completed)}
					/>
				))}
			</ul>
		</>
	);
}
