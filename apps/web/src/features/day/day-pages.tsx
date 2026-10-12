import type { CalendarDate } from "@habits/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button.tsx";
import { useToday } from "@/lib/use-today.ts";
import { DayView } from "./day-view.tsx";

/** Always shows the user's current day, and follows it when the date turns. */
export function TodayPage() {
	const today = useToday();
	return <DayView date={today} today={today} />;
}

/**
 * A specific day, opened from the heatmap. Keyed by date: another day starts
 * locked again (the past-day unlock is state of one visit only).
 */
export function DayPage({ date }: { date: CalendarDate }) {
	const today = useToday();
	return (
		<div className="flex flex-col gap-4">
			<Link
				to="/"
				className={buttonVariants({
					variant: "ghost",
					className: "self-start",
				})}
			>
				<ArrowLeftIcon aria-hidden="true" />
				Voltar ao histórico
			</Link>
			<DayView key={date} date={date} today={today} />
		</div>
	);
}
