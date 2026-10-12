import { monthLabels, type YearGrid } from "@habits/core";
import { useLayoutEffect, useMemo, useRef } from "react";
import { monthShortName, weekdayInitial, weekdayName } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { HeatmapCell } from "./heatmap-cell.tsx";
import { CELL_SIZE, scrollLeftFor } from "./heatmap-utils.ts";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Year heatmap in the GitHub layout: one column per week (Sunday first),
 * weekday rows, month labels on top. Scrolls horizontally and starts with
 * the current week in view (the end of the year for past years).
 */
export function HeatmapGrid({ grid }: { grid: YearGrid }) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const labels = useMemo(
		() =>
			new Map(
				monthLabels(grid).map((label) => [label.week_index, label.month])
			),
		[grid]
	);
	const currentWeek = grid.today_week_index;

	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const column = scroller.querySelector<HTMLElement>("[data-current-week]");
		// Another year (no current week): show its end, the most recent days.
		scroller.scrollLeft = column
			? scrollLeftFor(column, scroller.clientWidth)
			: scroller.scrollWidth;
	}, [grid.year, currentWeek]);

	return (
		<div
			ref={scrollerRef}
			role="region"
			aria-label={`Histórico de ${grid.year}`}
			// Focusable so keyboard users can scroll it.
			tabIndex={0}
			className="overflow-x-auto overscroll-x-contain pb-3"
		>
			<div className="inline-flex gap-1">
				<div
					aria-hidden="true"
					className="sticky left-0 z-10 flex flex-col gap-1 bg-background pr-1"
				>
					<div className="h-5" />
					{WEEKDAYS.map((weekday) => (
						<div
							key={weekday}
							title={weekdayName(weekday)}
							className={cn(
								CELL_SIZE,
								"flex items-center justify-center text-xs font-bold text-muted"
							)}
						>
							{weekdayInitial(weekday)}
						</div>
					))}
				</div>

				{grid.weeks.map((week, index) => {
					const month = labels.get(index);
					return (
						<div
							key={week.start}
							data-week-index={index}
							data-current-week={index === currentWeek ? "" : undefined}
							className="flex flex-col gap-1"
						>
							<div className="relative h-5">
								{month !== undefined && (
									<span className="absolute left-0 text-xs font-semibold whitespace-nowrap text-muted capitalize">
										{monthShortName(month)}
									</span>
								)}
							</div>
							{week.days.map((cell) => (
								<HeatmapCell key={cell.date} cell={cell} />
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}
