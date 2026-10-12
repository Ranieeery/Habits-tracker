import type { CalendarDate } from "@habits/contracts";
import { formatRelativeDate, UPCOMING_DAYS, upcoming } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import {
	DateChip,
	ScheduleStrip,
} from "@/features/habits/schedule-summary.tsx";
import { habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";

/**
 * "Próximos" on today's view (read-only): the coming dates of habits that do
 * not repeat by weekday, from the habits already loaded (core's `upcoming`:
 * by date, then in the user's order). One card per occurrence, in the habits
 * screen's style: the date as a small calendar block, the name and how it
 * repeats. Hidden when there is nothing in the next UPCOMING_DAYS days.
 */
export function UpcomingSection({ today }: { today: CalendarDate }) {
	const { api } = useServices();
	const timeZone = useUserTimeZone();
	const habits = useQuery(habitsQuery(api));
	if (!habits.data) return null;
	const items = upcoming(habits.data, today, { timeZone });
	if (items.length === 0) return null;

	return (
		<section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
			<div className="flex flex-col gap-0.5">
				<h2 id="upcoming-title" className="font-display text-xl font-bold">
					Próximos
				</h2>
				<p className="text-xs text-night-subtle">
					Nos próximos {UPCOMING_DAYS} dias.
				</p>
			</div>
			<ul className="flex flex-col gap-2">
				{items.map(({ date, habit }) => (
					<li
						key={`${habit.id}:${date}`}
						className="flex items-center gap-3 rounded-xl border border-night-border bg-night-surface p-2 pr-4"
					>
						<DateChip date={date} today={today} />
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<span data-title="" className="font-semibold break-words">
								<span className="sr-only">
									{formatRelativeDate(date, today)}:{" "}
								</span>
								{habit.name}
							</span>
							<ScheduleStrip habit={habit} today={today} muted={false} />
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
