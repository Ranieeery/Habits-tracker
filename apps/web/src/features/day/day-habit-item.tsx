import type { Habit } from "@habits/contracts";
import type { OverdueLabel } from "@habits/core";
import { CalendarClock } from "lucide-react";
import { useId, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { pulse, release } from "@/features/heatmap/pulse.ts";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion.ts";
import { cn } from "@/lib/utils.ts";

/**
 * One habit of a day with its checkbox: the whole row is the target (44px+).
 * Shared by the day view and the heatmap's "Hoje" panel. Checking pulses the
 * box and unchecking dips it (both skipped with reduced motion). An overdue
 * habit (2.8.0) carries the "Atrasado desde 11/10" badge (icon and text,
 * never color alone), read as "Nome, atrasado desde 11 de outubro".
 */
export function DayHabitItem({
	habit,
	completed,
	editable,
	overdue = null,
	onToggle,
}: {
	habit: Pick<Habit, "id" | "name">;
	completed: boolean;
	editable: boolean;
	overdue?: OverdueLabel | null;
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
					// Explicit: a hidden text inside the label would be read with a
					// space before the comma ("Nome , atrasado…").
					aria-label={overdue ? `${habit.name}, ${overdue.spoken}` : undefined}
					checked={completed}
					disabled={!editable}
					onCheckedChange={(checked) => {
						const value = checked === true;
						if (!reducedMotion) (value ? pulse : release)(box.current);
						onToggle(value);
					}}
				/>
				<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<span
						className={cn(
							"min-w-0 font-medium break-words motion-safe:transition-colors motion-safe:duration-150",
							completed && "text-night-muted line-through"
						)}
					>
						{habit.name}
					</span>
					{overdue && (
						<span
							aria-hidden="true"
							className="inline-flex items-center gap-1 rounded-md border border-night-warning/60 bg-night-warning-surface px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-night-warning"
						>
							<CalendarClock className="size-3.5 shrink-0" />
							{overdue.text}
						</span>
					)}
				</span>
			</label>
		</li>
	);
}
