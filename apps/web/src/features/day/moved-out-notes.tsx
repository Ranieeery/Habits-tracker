import type { CalendarDate } from "@habits/contracts";
import { type MovedOutItem, movedOutLabel } from "@habits/core";
import { CalendarArrowUpIcon } from "lucide-react";

/**
 * The occurrences postponed away from the day shown (2.16.0): read-only
 * notes "Pagar conta · Adiado para 27/10", without a checkbox, so the habit
 * missing from the list is explained. Only on today and the preview days
 * (the history stays as it was).
 */
export function MovedOutNotes({
	items,
	today,
}: {
	items: readonly MovedOutItem[] | undefined;
	today: CalendarDate;
}) {
	if (!items || items.length === 0) return null;
	return (
		<ul aria-label="Adiados deste dia" className="-mx-2 flex flex-col">
			{items.map(({ habit, toDate }) => {
				const label = movedOutLabel(toDate, today);
				return (
					<li
						key={habit.id}
						className="flex min-h-touch items-center gap-3 px-2 py-1.5 text-night-muted"
					>
						<CalendarArrowUpIcon
							className="size-5 shrink-0 text-night-subtle"
							aria-hidden="true"
						/>
						<span className="min-w-0 break-words">
							<span className="text-night-foreground">{habit.name}</span>
							<span aria-hidden="true"> · {label.text}</span>
							<span className="sr-only">, {label.spoken}</span>
						</span>
					</li>
				);
			})}
		</ul>
	);
}
