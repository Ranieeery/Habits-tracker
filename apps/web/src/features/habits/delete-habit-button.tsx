import type { Habit } from "@habits/contracts";
import { Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";

/**
 * "Apagar" for an archived habit (2.11.0; archiving stays the default way
 * out). Asks first in an alert dialog with Cancelar focused, since deleting
 * also takes the habit out of past days.
 */
export function DeleteHabitButton({
	habit,
	disabled,
	onDelete,
}: {
	habit: Habit;
	disabled?: boolean;
	onDelete: (habit: Habit) => void;
}) {
	const [open, setOpen] = useState(false);
	const cancelRef = useRef<HTMLButtonElement>(null);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Apagar ${habit.name}`}
					disabled={disabled}
					className="hover:text-night-danger"
				>
					<Trash2Icon aria-hidden="true" />
				</Button>
			</DialogTrigger>
			<DialogContent
				role="alertdialog"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					cancelRef.current?.focus();
				}}
			>
				<DialogHeader>
					<DialogTitle>Apagar hábito?</DialogTitle>
					<DialogDescription>
						“{habit.name}” e todo o histórico dele saem do mapa e dos dias. Para
						manter o histórico, deixe-o arquivado.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						ref={cancelRef}
						variant="ghost"
						onClick={() => setOpen(false)}
					>
						Cancelar
					</Button>
					<Button
						variant="danger"
						onClick={() => {
							setOpen(false);
							onDelete(habit);
						}}
					>
						<Trash2Icon aria-hidden="true" />
						Apagar
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
