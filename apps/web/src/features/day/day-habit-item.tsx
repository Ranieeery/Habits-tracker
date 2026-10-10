import type { Habit } from "@habits/contracts";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";

export function DayHabitItem({
	habit,
	completed,
	editable,
	onToggle,
}: {
	habit: Pick<Habit, "id" | "name">;
	completed: boolean;
	editable: boolean;
	onToggle: (completed: boolean) => void;
}) {
	const id = useId();
	return (
		<li>
			<label
				htmlFor={id}
				className={cn(
					"flex min-h-touch items-center gap-3 rounded-lg px-2 py-2 transition-colors",
					editable ? "cursor-pointer hover:bg-surface" : "cursor-default"
				)}
			>
				<Checkbox
					id={id}
					checked={completed}
					disabled={!editable}
					onCheckedChange={(checked) => onToggle(checked === true)}
				/>
				<span
					className={cn(
						"text-lg font-semibold transition-colors",
						completed && "text-muted line-through"
					)}
				>
					{habit.name}
				</span>
			</label>
		</li>
	);
}
