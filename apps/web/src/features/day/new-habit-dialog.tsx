import type { CalendarDate } from "@habits/contracts";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";
import { HabitForm } from "../habits/habit-form.tsx";
import { useDiscardGuard } from "../habits/use-discard-guard.ts";
import { useCreateHabitToday } from "./use-create-habit-today.ts";

/**
 * "Novo hábito" on today's view: a dialog with the habits form (every
 * weekday selected, starting today), creating the habit. Radix traps the focus,
 * closes on Esc and gives the focus back to this button. With unsaved
 * changes, closing asks first (2.16.2, `useDiscardGuard`).
 */
export function NewHabitDialog({
	today,
	className,
}: {
	today: CalendarDate;
	className?: string;
}) {
	const { newId } = useServices();
	const timeZone = useUserTimeZone();
	const create = useCreateHabitToday(today);
	// The id of the habit being created: one per opening, null when closed.
	const [habitId, setHabitId] = useState<string | null>(null);

	const close = () => {
		if (!create.isPending) setHabitId(null);
	};
	const guard = useDiscardGuard(close);

	const onOpenChange = (open: boolean) => {
		if (open) {
			create.reset();
			setHabitId(newId());
		} else if (!create.isPending) {
			guard.onOpenChange(false);
		}
	};

	const error =
		create.error && !isUnauthorized(create.error)
			? `Não foi possível criar o hábito. ${errorMessage(create.error)}`
			: undefined;

	return (
		<Dialog open={habitId !== null} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" className={className}>
					<PlusIcon className="text-night-accent-text" aria-hidden="true" />
					Novo hábito
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Novo hábito</DialogTitle>
					<DialogDescription>
						Começa a contar na data escolhida e não muda os dias anteriores.
					</DialogDescription>
				</DialogHeader>
				{habitId && (
					<HabitForm
						key={habitId}
						today={today}
						timeZone={timeZone}
						submitLabel="Criar"
						autoFocusName
						onDirtyChange={guard.onDirtyChange}
						pending={create.isPending}
						error={error}
						onSubmit={(values) =>
							values.schedule &&
							create.submit(
								{ id: habitId, ...values, schedule: values.schedule },
								() => setHabitId(null)
							)
						}
					/>
				)}
				<DiscardChangesDialog {...guard.confirm} />
			</DialogContent>
		</Dialog>
	);
}
