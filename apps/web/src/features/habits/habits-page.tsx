import type { Habit } from "@habits/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { weekdayInitial, weekdayName } from "@/lib/format.ts";
import {
	createHabit,
	habitsQuery,
	invalidateHabitData,
	updateHabit,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useToday } from "@/lib/use-today.ts";
import { HabitForm, type HabitFormValues } from "./habit-form.tsx";

type Editing = { mode: "create" } | { mode: "edit"; habit: Habit } | null;

function notifyError(title: string) {
	return (error: unknown) => {
		if (!isUnauthorized(error)) {
			toast.error(title, { description: errorMessage(error) });
		}
	};
}

export function HabitsPage() {
	const { api } = useServices();
	const queryClient = useQueryClient();
	const today = useToday();
	const habits = useQuery(habitsQuery(api));
	const [editing, setEditing] = useState<Editing>(null);

	const save = useMutation({
		mutationFn: (values: HabitFormValues) =>
			editing?.mode === "edit"
				? updateHabit(api, editing.habit.id, values)
				: createHabit(api, { ...values, start_date: today }),
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

	const active = habits.data?.filter((habit) => habit.archived_at === null);
	const archived = habits.data?.filter((habit) => habit.archived_at !== null);

	return (
		<section aria-labelledby="habits-title" className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<h1 id="habits-title" className="text-3xl font-extrabold">
					Hábitos
				</h1>
				<Button
					variant="outline"
					onClick={() => setEditing({ mode: "create" })}
				>
					<PlusIcon className="text-accent" aria-hidden="true" />
					Novo hábito
				</Button>
			</header>

			{habits.isPending ? (
				<div className="flex flex-col gap-2" aria-busy="true">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : habits.isError ? (
				<ErrorState error={habits.error} onRetry={() => habits.refetch()} />
			) : (
				<>
					{active?.length === 0 ? (
						<EmptyState
							title="Nenhum hábito ainda"
							description="Crie um hábito e escolha os dias da semana em que ele se repete."
						/>
					) : (
						<ul className="flex flex-col gap-2">
							{active?.map((habit) => (
								<HabitRow key={habit.id} habit={habit}>
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
										onClick={() =>
											archive.mutate({ id: habit.id, archived: true })
										}
									>
										<ArchiveIcon aria-hidden="true" />
									</Button>
								</HabitRow>
							))}
						</ul>
					)}

					{archived && archived.length > 0 && (
						<details className="group rounded-xl border border-border">
							<summary className="flex min-h-touch cursor-pointer items-center px-4 font-semibold text-muted">
								Arquivados ({archived.length})
							</summary>
							<ul className="flex flex-col gap-2 p-2">
								{archived.map((habit) => (
									<HabitRow key={habit.id} habit={habit} muted>
										<Button
											variant="ghost"
											size="sm"
											disabled={archive.isPending}
											onClick={() =>
												archive.mutate({ id: habit.id, archived: false })
											}
										>
											<ArchiveRestoreIcon aria-hidden="true" />
											Desarquivar
										</Button>
									</HabitRow>
								))}
							</ul>
						</details>
					)}
				</>
			)}

			<Dialog
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editing?.mode === "edit" ? "Editar hábito" : "Criar hábito"}
						</DialogTitle>
						<DialogDescription>
							{editing?.mode === "edit"
								? "Mudar os dias altera também a contagem dos dias passados."
								: "O hábito passa a contar a partir de hoje."}
						</DialogDescription>
					</DialogHeader>
					{editing && (
						<HabitForm
							key={editing.mode === "edit" ? editing.habit.id : "new"}
							initial={editing.mode === "edit" ? editing.habit : undefined}
							submitLabel={editing.mode === "edit" ? "Salvar" : "Criar"}
							pending={save.isPending}
							onSubmit={(values) => save.mutate(values)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</section>
	);
}

function HabitRow({
	habit,
	muted = false,
	children,
}: {
	habit: Habit;
	muted?: boolean;
	children: React.ReactNode;
}) {
	const days = habit.schedule.type === "weekdays" ? habit.schedule.days : [];
	return (
		<li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<span
					className={muted ? "truncate text-muted" : "truncate font-semibold"}
				>
					{habit.name}
				</span>
				<span
					className="text-xs tracking-widest text-muted"
					aria-label={days.map(weekdayName).join(", ")}
				>
					{days.map(weekdayInitial).join(" ")}
				</span>
			</div>
			{children}
		</li>
	);
}
