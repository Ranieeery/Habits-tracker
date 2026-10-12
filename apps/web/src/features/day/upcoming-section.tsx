import type { CalendarDate } from "@habits/contracts";
import { formatRelativeDate, UPCOMING_DAYS, upcoming } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { habitsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";

/**
 * "Próximos" on today's view (read-only): the coming dates of habits that do
 * not repeat by weekday, from the habits already loaded (core's `upcoming`).
 * Hidden when there is nothing in the next UPCOMING_DAYS days.
 */
export function UpcomingSection({ today }: { today: CalendarDate }) {
	const { api } = useServices();
	const timeZone = useUserTimeZone();
	const habits = useQuery(habitsQuery(api));
	if (!habits.data) return null;
	const items = upcoming(habits.data, today, { timeZone });
	if (items.length === 0) return null;

	return (
		<section aria-labelledby="upcoming-title" className="flex flex-col gap-2">
			<h2 id="upcoming-title" className="text-lg font-bold">
				Próximos
			</h2>
			<p className="text-xs text-muted">Nos próximos {UPCOMING_DAYS} dias.</p>
			<ul className="flex flex-col gap-1">
				{items.map(({ date, habit }) => (
					<li
						key={`${habit.id}:${date}`}
						className="flex min-h-touch items-center gap-3 rounded-xl border border-border bg-surface px-4"
					>
						<span className="w-24 shrink-0 text-sm font-semibold text-muted">
							{formatRelativeDate(date, today)}
						</span>
						<span className="min-w-0 truncate">{habit.name}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
