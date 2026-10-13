import type { CalendarDate } from "@habits/contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useToday } from "@/data/today.ts";
import { DayView } from "@/features/day/day-screen.tsx";
import { TimezoneBanner } from "@/features/settings/timezone-banner.tsx";
import { TabHeader } from "@/features/shell/tab-header.tsx";
import { WeekStrip } from "./week-strip.tsx";

/**
 * The Hoje tab (2.6.0), opened first: the daily action at full height and
 * in the thumb's reach. The strip picks one of the last seven days; the
 * choice lives in memory only and goes back to today when the tab loses
 * focus (and follows "today" across midnight, since null means today). The
 * day view is keyed by date, so another day starts locked again.
 */
export function TodayScreen() {
	const today = useToday();
	const [chosen, setChosen] = useState<CalendarDate | null>(null);
	const date = chosen ?? today;

	useFocusEffect(
		useCallback(() => {
			return () => setChosen(null);
		}, [])
	);

	return (
		<DayView
			key={date}
			date={date}
			today={today}
			inTabs
			header={
				<>
					<TabHeader />
					<TimezoneBanner />
					<WeekStrip
						today={today}
						selected={date}
						onSelect={(next) => setChosen(next === today ? null : next)}
					/>
				</>
			}
		/>
	);
}
