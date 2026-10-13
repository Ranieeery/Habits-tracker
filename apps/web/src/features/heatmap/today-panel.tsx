import type { CalendarDate, Habit } from "@habits/contracts";
import { completionRatio, type DayItems } from "@habits/core";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { buttonVariants } from "@/components/ui/button.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { formatLongDate } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { DayItemsList } from "@/features/day/day-items-list.tsx";
import { useDayItems } from "@/features/day/use-day-items.ts";

/**
 * Today's habits next to the heatmap (below it on narrow screens), checked
 * with the day view's own mutation: optimistic, rolled back on failure, with
 * "Desfazer". Overdue fixed-day habits come first with their badge (2.8.0,
 * `useDayItems`). Creating habits stays in the day view ("Abrir o dia").
 */
export function TodayPanel({ today }: { today: CalendarDate }) {
	const { day, view, toggle } = useDayItems(today);
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
			) : view === null ? null : view.items.length === 0 ? (
				<p className="text-sm text-night-muted">
					Nenhum hábito previsto para hoje.
				</p>
			) : (
				<TodayList
					today={today}
					view={view}
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
	today,
	view,
	onToggle,
}: {
	today: CalendarDate;
	view: DayItems;
	onToggle: (habit: Pick<Habit, "id" | "name">, completed: boolean) => void;
}) {
	const { completed: done, possible } = view.progress;
	const ratio = completionRatio(done, possible);

	return (
		<>
			{possible === 0 ? (
				// Only overdue habits, none done yet: no "0 de 0" bar.
				<p className="text-sm text-night-muted">
					Nada previsto para hoje além dos atrasados.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					<p className="text-sm text-night-muted tabular-nums">
						{done} de {possible} concluídos
					</p>
					<div
						role="progressbar"
						aria-label="Progresso de hoje"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(ratio * 100)}
						aria-valuetext={`${done} de ${possible} hábitos concluídos`}
						className="h-1.5 overflow-hidden rounded-full bg-night-surface-raised"
					>
						<div
							className="h-full origin-left rounded-full bg-night-accent motion-safe:transition-transform motion-safe:duration-200"
							style={{ transform: `scaleX(${ratio})` }}
						/>
					</div>
				</div>
			)}
			<DayItemsList
				date={today}
				items={view.items}
				editable
				onToggle={onToggle}
			/>
		</>
	);
}
