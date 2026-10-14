import type { Habit } from "@habits/contracts";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useScheduleOptions } from "@/lib/use-schedule-options.ts";
import { useToday, useUserTimeZone } from "@/lib/use-today.ts";
import { HabitForm } from "./habit-form.tsx";
import { useEditHabit } from "./use-edit-habit.ts";

/**
 * Editing one habit in a dialog (2.12.0: from the habit's page; 2.15.0:
 * also from a day's actions menu, without leaving the day). Saving is
 * optimistic (`useEditHabit`); a failure keeps the dialog open with what was
 * typed.
 */
export function EditHabitDialog({
	habit,
	open,
	onOpenChange,
}: {
	habit: Habit;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const today = useToday();
	const timeZone = useUserTimeZone();
	const { options } = useScheduleOptions();
	const save = useEditHabit(habit, () => onOpenChange(false));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar hábito</DialogTitle>
					<DialogDescription>
						Vale para todos os dias. Mudar a repetição altera também a contagem
						dos dias passados.
					</DialogDescription>
				</DialogHeader>
				{open && (
					<HabitForm
						key={habit.id}
						initial={habit}
						today={today}
						timeZone={timeZone}
						reschedules={options.reschedules}
						submitLabel="Salvar"
						pending={save.isPending}
						onSubmit={(values) => save.mutate(values)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
