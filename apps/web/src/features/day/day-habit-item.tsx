import type { Habit } from "@habits/contracts";
import { useId, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { pulse, release } from "@/features/heatmap/pulse.ts";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion.ts";
import { cn } from "@/lib/utils.ts";

/**
 * One habit of a day with its checkbox: the whole row is the target (44px+).
 * Shared by the day view and the heatmap's "Hoje" panel. Checking pulses the
 * box and unchecking dips it (both skipped with reduced motion).
 */
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
	const box = useRef<HTMLButtonElement>(null);
	const reducedMotion = usePrefersReducedMotion();

	return (
		<li>
			<label
				htmlFor={id}
				className={cn(
					"flex min-h-touch items-center gap-3 rounded-lg px-2 py-1.5 motion-safe:transition-colors motion-safe:duration-150",
					editable
						? "cursor-pointer hover:bg-night-surface-raised"
						: "cursor-default"
				)}
			>
				<Checkbox
					ref={box}
					id={id}
					checked={completed}
					disabled={!editable}
					onCheckedChange={(checked) => {
						const value = checked === true;
						if (!reducedMotion) (value ? pulse : release)(box.current);
						onToggle(value);
					}}
				/>
				<span
					className={cn(
						"min-w-0 font-medium break-words motion-safe:transition-colors motion-safe:duration-150",
						completed && "text-night-muted line-through"
					)}
				>
					{habit.name}
				</span>
			</label>
		</li>
	);
}
