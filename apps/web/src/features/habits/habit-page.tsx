import { isSupportedSchedule } from "@habits/contracts";
import { hasDescription, parseDescription } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArrowLeftIcon,
	NotebookTextIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { DescriptionText } from "@/components/description-text.tsx";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday, useUserTimeZone } from "@/lib/use-today.ts";
import { EditHabitDialog } from "./edit-habit-dialog.tsx";
import { NextBadge } from "./habit-card.tsx";
import { ScheduleStrip } from "./schedule-summary.tsx";

/** One entrance for the page's panels (DESIGN.md: 120-200 ms, motion-safe). */
const ENTER =
	"motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-safe:fill-mode-both";

/**
 * A habit's page (2.12.0): who it is and when it happens (the card's week
 * strip and "Hoje"/"Próxima" badge, larger), then the whole description, where
 * "Abrir descrição completa" of the quick look leads. "Editar" opens the edit
 * dialog; without a description, "Adicionar descrição" does.
 */
export function HabitPage({ habitId }: { habitId: string }) {
	const { api } = useServices();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const habits = useQuery(habitsQuery(api));
	const [editing, setEditing] = useState(false);
	const descriptionTitle = useId();
	const habit = habits.data?.find((item) => item.id === habitId);

	return (
		<section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<Link
				to="/habits"
				className="inline-flex min-h-touch items-center gap-2 self-start rounded-md text-sm text-night-muted transition-colors hover:text-night-foreground"
			>
				<ArrowLeftIcon className="size-4" aria-hidden="true" />
				Hábitos
			</Link>
			{habits.isPending ? (
				<div className="flex flex-col gap-4" aria-hidden="true">
					<Skeleton className="h-40 w-full rounded-2xl" />
					<Skeleton className="h-32 w-full rounded-2xl" />
				</div>
			) : habits.isError ? (
				<ErrorState
					error={habits.error}
					onRetry={() => void habits.refetch()}
				/>
			) : !habit ? (
				<EmptyState
					title="Hábito não encontrado"
					description="Ele pode ter sido apagado em outro aparelho."
				/>
			) : (
				<>
					<header
						className={`relative isolate overflow-hidden rounded-2xl border border-night-border bg-night-surface p-5 sm:p-6 ${ENTER}`}
					>
						{/* The page's one glow, behind the title. */}
						<div
							aria-hidden="true"
							className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-night-accent/20 blur-3xl"
						/>
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 flex-col gap-3">
								<p className="flex items-center gap-2 text-sm text-night-muted">
									Hábito
									{habit.archived_at !== null && (
										<span className="inline-flex items-center gap-1 rounded-full border border-night-border px-2 py-0.5 text-xs">
											<ArchiveIcon className="size-3" aria-hidden="true" />
											Arquivado
										</span>
									)}
								</p>
								<h1 className="font-display text-3xl font-bold tracking-tight break-words sm:text-4xl">
									{habit.name}
								</h1>
							</div>
							<Button
								variant="outline"
								className="shrink-0"
								onClick={() => setEditing(true)}
							>
								<PencilIcon aria-hidden="true" />
								Editar
							</Button>
						</div>
						{isSupportedSchedule(habit.schedule) && (
							<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
								<ScheduleStrip habit={habit} today={today} muted={false} />
								<NextBadge habit={habit} today={today} timeZone={timeZone} />
							</div>
						)}
					</header>

					<section
						aria-labelledby={descriptionTitle}
						className={`flex flex-col gap-3 motion-safe:delay-75 ${ENTER}`}
					>
						<h2
							id={descriptionTitle}
							className="flex items-center gap-2 font-display text-lg font-semibold"
						>
							<NotebookTextIcon
								className="size-5 text-night-accent-text"
								aria-hidden="true"
							/>
							Descrição
						</h2>
						{hasDescription(habit) ? (
							<DescriptionText
								blocks={parseDescription(habit.description)}
								variant="reading"
								className="rounded-2xl border border-night-border bg-night-surface p-5 sm:p-6"
							/>
						) : (
							<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-night-border p-8 text-center">
								<p className="text-night-muted">
									Sem descrição ainda. Anote passos, detalhes ou um link.
								</p>
								<Button variant="secondary" onClick={() => setEditing(true)}>
									<PlusIcon aria-hidden="true" />
									Adicionar descrição
								</Button>
							</div>
						)}
					</section>

					<EditHabitDialog
						habit={habit}
						open={editing}
						onOpenChange={setEditing}
					/>
				</>
			)}
		</section>
	);
}
