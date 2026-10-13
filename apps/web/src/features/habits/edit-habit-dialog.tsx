import type { Habit } from "@habits/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { invalidateHabitData, updateHabit } from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useToday, useUserTimeZone } from "@/lib/use-today.ts";
import { HabitForm, type HabitFormValues } from "./habit-form.tsx";

/** Editing one habit in a dialog (2.12.0: from the habit's page). */
export function EditHabitDialog({
	habit,
	open,
	onOpenChange,
}: {
	habit: Habit;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { api } = useServices();
	const queryClient = useQueryClient();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const save = useMutation({
		mutationFn: ({ name, description, schedule }: HabitFormValues) =>
			updateHabit(api, habit.id, {
				name,
				description,
				...(schedule && { schedule }),
			}),
		onSuccess: () => {
			toast.success("Hábito atualizado");
			onOpenChange(false);
		},
		onError: (error) => {
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar o hábito", {
					description: errorMessage(error),
				});
			}
		},
		onSettled: () => invalidateHabitData(queryClient),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar hábito</DialogTitle>
					<DialogDescription>
						Mudar a repetição altera também a contagem dos dias passados.
					</DialogDescription>
				</DialogHeader>
				{open && (
					<HabitForm
						key={habit.id}
						initial={habit}
						today={today}
						timeZone={timeZone}
						submitLabel="Salvar"
						pending={save.isPending}
						onSubmit={(values) => save.mutate(values)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
