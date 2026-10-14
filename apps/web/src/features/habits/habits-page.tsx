import { type Habit, isSupportedSchedule } from "@habits/contracts";
import { isDeadlineSettled } from "@habits/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	EllipsisVerticalIcon,
	GripVerticalIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog.tsx";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { errorMessage } from "@/lib/errors.ts";
import {
	createHabit,
	deadlineFirstsQuery,
	habitsQuery,
	invalidateHabitData,
	updateHabit,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useScheduleOptions } from "@/lib/use-schedule-options.ts";
import { useToday, useUserTimeZone } from "@/lib/use-today.ts";
import { cn } from "@/lib/utils.ts";
import { DeleteHabitButton } from "./delete-habit-button.tsx";
import { HabitCard } from "./habit-card.tsx";
import { HabitForm, type HabitFormValues } from "./habit-form.tsx";
import { useDeleteHabit } from "./use-delete-habit.ts";
import { useDiscardGuard } from "./use-discard-guard.ts";
import { useReorderHabit } from "./use-reorder-habit.ts";
import { useSortableList } from "./use-sortable-list.ts";

/** A new habit gets its id once per opening (a double submit creates one). */
type Editing =
	{ mode: "create"; id: string } | { mode: "edit"; habit: Habit } | null;

/** A single-date habit whose date has passed (kept, not archived). */
function isPastOnce(habit: Habit, today: string): boolean {
	return (
		isSupportedSchedule(habit.schedule) &&
		habit.schedule.type === "once" &&
		habit.schedule.date < today
	);
}

function notifyError(title: string) {
	return (error: unknown) => {
		if (!isUnauthorized(error)) {
			toast.error(title, { description: errorMessage(error) });
		}
	};
}

export function HabitsPage() {
	const { api, newId } = useServices();
	const queryClient = useQueryClient();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const { options: scheduleOptions } = useScheduleOptions();
	const habits = useQuery(habitsQuery(api));
	const firsts = useQuery(deadlineFirstsQuery(api));
	const [editing, setEditing] = useState<Editing>(null);
	// 2.16.2: Esc, a click outside or "Fechar" with unsaved changes ask first.
	const guard = useDiscardGuard(() => setEditing(null));

	const save = useMutation({
		mutationFn: ({
			name,
			description,
			schedule,
			start_date,
		}: HabitFormValues) => {
			if (editing?.mode === "edit") {
				return updateHabit(api, editing.habit.id, {
					name,
					description,
					...(schedule && { schedule }),
				});
			}
			if (!schedule || !editing) throw new Error("Missing schedule");
			return createHabit(api, {
				id: editing.id,
				name,
				description,
				schedule,
				start_date,
			});
		},
		onSuccess: () => {
			toast.success(
				editing?.mode === "edit" ? "Hábito atualizado" : "Hábito criado"
			);
			setEditing(null);
		},
		onError: notifyError("Não foi possível salvar o hábito"),
		onSettled: () => invalidateHabitData(queryClient),
	});

	const archive = useMutation({
		mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
			updateHabit(api, id, { archived }),
		onSuccess: (habit) =>
			toast.success(
				habit.archived_at === null ? "Hábito restaurado" : "Hábito arquivado"
			),
		onError: notifyError("Não foi possível alterar o hábito"),
		onSettled: () => invalidateHabitData(queryClient),
	});

	const deletion = useDeleteHabit();

	// Already in the user's order (the API sorts by `sort_key`).
	const live = habits.data?.filter((habit) => habit.archived_at === null);
	// Past single dates, and deadline tasks done or past their overdue
	// window (2.13.0), go to "Passados".
	const isPast = (habit: Habit) =>
		isPastOnce(habit, today) ||
		isDeadlineSettled(habit, firsts.data?.[habit.id], today);
	const active = live?.filter((habit) => !isPast(habit));
	const past = live?.filter(isPast);
	const archived = habits.data?.filter((habit) => habit.archived_at !== null);

	const editAndArchive = (habit: Habit) => (
		<>
			<Button
				variant="ghost"
				size="icon"
				aria-label={`Editar ${habit.name}`}
				onClick={() => setEditing({ mode: "edit", habit })}
			>
				<PencilIcon aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				aria-label={`Arquivar ${habit.name}`}
				disabled={archive.isPending}
				onClick={() => archive.mutate({ id: habit.id, archived: true })}
			>
				<ArchiveIcon aria-hidden="true" />
			</Button>
		</>
	);

	return (
		<section
			aria-labelledby="habits-title"
			className="mx-auto flex w-full max-w-2xl flex-col gap-6"
		>
			<header className="flex flex-wrap items-center justify-between gap-4">
				<h1
					id="habits-title"
					className="font-display text-4xl font-bold tracking-tight"
				>
					Hábitos
				</h1>
				<Button
					variant="outline"
					onClick={() => setEditing({ mode: "create", id: newId() })}
				>
					<PlusIcon className="text-night-accent-text" aria-hidden="true" />
					Novo hábito
				</Button>
			</header>

			{habits.isPending ? (
				<div className="flex flex-col gap-2" aria-busy="true">
					<Skeleton className="h-20 w-full rounded-xl" />
					<Skeleton className="h-20 w-full rounded-xl" />
				</div>
			) : habits.isError ? (
				<ErrorState error={habits.error} onRetry={() => habits.refetch()} />
			) : (
				<>
					{active?.length === 0 ? (
						<EmptyState
							title="Nenhum hábito ainda"
							description="Crie um hábito e escolha como ele se repete: dias da semana, a cada N dias, dias do mês, uma data ou todo ano."
						/>
					) : (
						<ActiveList
							habits={active ?? []}
							today={today}
							archiving={archive.isPending}
							onEdit={(habit) => setEditing({ mode: "edit", habit })}
							onArchive={(habit) =>
								archive.mutate({ id: habit.id, archived: true })
							}
						/>
					)}

					{past && past.length > 0 && (
						<details className="group rounded-xl border border-night-border">
							<summary className="flex min-h-touch cursor-pointer items-center rounded-xl px-4 font-semibold text-night-muted hover:text-night-foreground">
								Passados ({past.length})
							</summary>
							<ul className="flex flex-col gap-2 p-2">
								{past.map((habit) => (
									<HabitCard
										key={habit.id}
										habit={habit}
										today={today}
										muted
										actions={editAndArchive(habit)}
									/>
								))}
							</ul>
						</details>
					)}

					{archived && archived.length > 0 && (
						<details className="group rounded-xl border border-night-border">
							<summary className="flex min-h-touch cursor-pointer items-center rounded-xl px-4 font-semibold text-night-muted hover:text-night-foreground">
								Arquivados ({archived.length})
							</summary>
							<ul className="flex flex-col gap-2 p-2">
								{archived.map((habit) => (
									<HabitCard
										key={habit.id}
										habit={habit}
										today={today}
										muted
										actions={
											<>
												<Button
													variant="ghost"
													size="sm"
													disabled={archive.isPending || deletion.isPending}
													onClick={() =>
														archive.mutate({ id: habit.id, archived: false })
													}
												>
													<ArchiveRestoreIcon aria-hidden="true" />
													Desarquivar
												</Button>
												<DeleteHabitButton
													habit={habit}
													disabled={archive.isPending || deletion.isPending}
													onDelete={deletion.remove}
												/>
											</>
										}
									/>
								))}
							</ul>
						</details>
					)}
				</>
			)}

			<Dialog
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) guard.onOpenChange(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editing?.mode === "edit" ? "Editar hábito" : "Criar hábito"}
						</DialogTitle>
						<DialogDescription>
							{editing?.mode === "edit"
								? "Mudar a repetição altera também a contagem dos dias passados."
								: "O hábito passa a contar a partir da data escolhida."}
						</DialogDescription>
					</DialogHeader>
					{editing && (
						<HabitForm
							key={editing.mode === "edit" ? editing.habit.id : editing.id}
							initial={editing.mode === "edit" ? editing.habit : undefined}
							today={today}
							timeZone={timeZone}
							reschedules={
								editing.mode === "edit"
									? scheduleOptions.reschedules
									: undefined
							}
							autoFocusName={editing.mode === "create"}
							submitLabel={editing.mode === "edit" ? "Salvar" : "Criar"}
							pending={save.isPending}
							onDirtyChange={guard.onDirtyChange}
							onSubmit={(values) => save.mutate(values)}
						/>
					)}
					<DiscardChangesDialog {...guard.confirm} />
				</DialogContent>
			</Dialog>
		</section>
	);
}

/**
 * The active habits, in the user's order: drag by the handle (pointer or
 * keyboard), or the up/down buttons (from `md`; in the "Mais ações" menu on
 * phones, next to "Arquivar"). Moving writes one key (core `moveHabit`).
 */
function ActiveList({
	habits,
	today,
	archiving,
	onEdit,
	onArchive,
}: {
	habits: Habit[];
	today: string;
	archiving: boolean;
	onEdit: (habit: Habit) => void;
	onArchive: (habit: Habit) => void;
}) {
	const reorder = useReorderHabit();
	const sortable = useSortableList({
		items: habits.map((habit) => ({ id: habit.id, label: habit.name })),
		onMove: (id, toIndex) => reorder.move(habits, id, toIndex),
	});
	// The moved card changes place in the DOM: keep the focus on the button
	// that moved it (or on its handle once that button is disabled).
	const listRef = useRef<HTMLUListElement>(null);
	const refocus = useRef<{ id: string; action: "up" | "down" } | null>(null);
	useEffect(() => {
		const target = refocus.current;
		if (!target) return;
		refocus.current = null;
		const card = listRef.current?.querySelector(
			`[data-habit-id="${target.id}"]`
		);
		const button = card?.querySelector<HTMLButtonElement>(
			`[data-action="${target.action}"]`
		);
		(button && !button.disabled
			? button
			: card?.querySelector<HTMLElement>("[data-action='handle']")
		)?.focus();
	}, [habits]);

	const step = (habit: Habit, index: number, action: "up" | "down") => {
		refocus.current = { id: habit.id, action };
		reorder.move(habits, habit.id, index + (action === "up" ? -1 : 1));
	};

	return (
		<>
			<p id={sortable.instructionsId} className="sr-only">
				Para reordenar pela alça: Espaço pega o hábito, as setas para cima e
				para baixo movem, Espaço solta e Esc cancela.
			</p>
			<p aria-live="assertive" className="sr-only">
				{sortable.message}
			</p>
			<ul
				ref={listRef}
				aria-label="Hábitos ativos"
				className="flex flex-col gap-2"
			>
				{habits.map((habit, index) => {
					const item = sortable.itemProps(habit.id, index);
					const lifted = item["data-dragging"] !== undefined;
					const first = index === 0;
					const last = index === habits.length - 1;
					return (
						<HabitCard
							key={habit.id}
							ref={item.ref}
							style={item.style}
							className={cn(
								item.className,
								lifted &&
									"border-night-accent-text bg-night-surface-raised shadow-xl shadow-night-bg/80"
							)}
							habit={habit}
							today={today}
							handle={
								<button
									type="button"
									data-action="handle"
									aria-label={`Reordenar ${habit.name}`}
									aria-roledescription="alça de arrastar"
									className="flex size-touch shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-night-subtle transition-colors hover:text-night-foreground active:cursor-grabbing"
									{...sortable.handleProps(habit.id, index)}
								>
									<GripVerticalIcon className="size-5" aria-hidden="true" />
								</button>
							}
							actions={
								<>
									<Button
										variant="ghost"
										size="icon"
										data-action="up"
										className="hidden md:inline-flex"
										aria-label={`Mover ${habit.name} para cima`}
										disabled={first}
										onClick={() => step(habit, index, "up")}
									>
										<ArrowUpIcon aria-hidden="true" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										data-action="down"
										className="hidden md:inline-flex"
										aria-label={`Mover ${habit.name} para baixo`}
										disabled={last}
										onClick={() => step(habit, index, "down")}
									>
										<ArrowDownIcon aria-hidden="true" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Editar ${habit.name}`}
										onClick={() => onEdit(habit)}
									>
										<PencilIcon aria-hidden="true" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="hidden md:inline-flex"
										aria-label={`Arquivar ${habit.name}`}
										disabled={archiving}
										onClick={() => onArchive(habit)}
									>
										<ArchiveIcon aria-hidden="true" />
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="md:hidden"
												aria-label={`Mais ações para ${habit.name}`}
											>
												<EllipsisVerticalIcon aria-hidden="true" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<DropdownMenuItem
												disabled={first}
												onSelect={() => step(habit, index, "up")}
											>
												<ArrowUpIcon aria-hidden="true" />
												Mover para cima
											</DropdownMenuItem>
											<DropdownMenuItem
												disabled={last}
												onSelect={() => step(habit, index, "down")}
											>
												<ArrowDownIcon aria-hidden="true" />
												Mover para baixo
											</DropdownMenuItem>
											<DropdownMenuItem
												disabled={archiving}
												onSelect={() => onArchive(habit)}
											>
												<ArchiveIcon aria-hidden="true" />
												Arquivar
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</>
							}
						/>
					);
				})}
			</ul>
		</>
	);
}
