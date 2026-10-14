import type { Habit } from "@habits/contracts";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog.tsx";
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
import { useDiscardGuard } from "./use-discard-guard.ts";
import { useEditHabit } from "./use-edit-habit.ts";

/**
 * Editing one habit in a dialog (2.12.0: from the habit's page; 2.15.0:
 * also from a day's actions menu, without leaving the day). Saving is
 * optimistic (`useEditHabit`); a failure keeps the dialog open with what was
 * typed. Closing with unsaved changes asks first (2.16.2); saving never does.
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
	const close = () => onOpenChange(false);
	const save = useEditHabit(habit, close);
	const guard = useDiscardGuard(close);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) =>
				next ? onOpenChange(true) : guard.onOpenChange(false)
			}
		>
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
						onDirtyChange={guard.onDirtyChange}
						pending={save.isPending}
						onSubmit={(values) => save.mutate(values)}
					/>
				)}
				<DiscardChangesDialog {...guard.confirm} />
			</DialogContent>
		</Dialog>
	);
}
