import { type GridCell, monthLabels, type YearGrid } from "@habits/core";
import {
	type FocusEvent,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { monthShortName, weekdayInitial, weekdayName } from "@/lib/format.ts";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion.ts";
import { cn } from "@/lib/utils.ts";
import { HeatmapCell } from "./heatmap-cell.tsx";
import { HeatmapTooltip, type TooltipTarget } from "./heatmap-tooltip.tsx";
import {
	isNavigable,
	nextCellIndex,
	scrollLeftFor,
	WEEKDAY_COLUMN,
} from "./heatmap-utils.ts";
import { pulse } from "./pulse.ts";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Entrance sweep: 6 ms per column plus one 220 ms cell, with some slack. */
const ENTRANCE_MS = 53 * 6 + 220 + 80;

/** Keeps the tooltip inside the container (about half its width). */
const TOOLTIP_HALF_WIDTH = 96;

/**
 * Year heatmap in the GitHub layout: one column per week (Sunday first),
 * one row per weekday, month labels on top. An ARIA grid with a single tab
 * stop (today, or the last focused day): arrows move by day and week,
 * Home/End along the weekday. Scrolls horizontally and starts with the
 * current week in view (the end of the year for past years). Mount it with
 * `key={year}`: the entrance sweep plays once per mount.
 */
export function HeatmapGrid({ grid }: { grid: YearGrid }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	const [entering, setEntering] = useState(true);
	const [activeDate, setActiveDate] = useState<string | null>(null);
	const [tooltip, setTooltip] = useState<TooltipTarget | null>(null);

	const labels = useMemo(
		() =>
			new Map(
				monthLabels(grid).map((label) => [label.week_index, label.month])
			),
		[grid]
	);
	// Week order (`week * 7 + weekday`), the order keyboard movement uses.
	const { cells, indexOf } = useMemo(() => {
		const flat = grid.weeks.flatMap((week) => week.days);
		return {
			cells: flat,
			indexOf: new Map(flat.map((cell, index) => [cell.date, index])),
		};
	}, [grid]);
	const navigable = useMemo(() => cells.map(isNavigable), [cells]);
	const currentWeek = grid.today_week_index;
	const todayCell = cells.find((cell) => cell.relation === "today");
	// The sweep starts at the present (today's week, or the end of a past
	// year) and unfolds into the past, so what is on screen lights first.
	const anchor = currentWeek ?? grid.weeks.length - 1;

	const tabStop =
		(activeDate !== null && navigable[indexOf.get(activeDate) ?? -1]
			? activeDate
			: null) ??
		todayCell?.date ??
		cells[navigable.lastIndexOf(true)]?.date;

	const animate = entering && !reducedMotion;
	useEffect(() => {
		if (!entering) return;
		const timer = setTimeout(() => setEntering(false), ENTRANCE_MS);
		return () => clearTimeout(timer);
	}, [entering]);
	// Any interaction ends the sweep at once: cells jump to their final state.
	const stopEntrance = () => {
		if (entering) setEntering(false);
	};

	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const column = scroller.querySelector<HTMLElement>("[data-current-week]");
		// Another year (no current week): show its end, the most recent days.
		scroller.scrollLeft = column
			? scrollLeftFor(column, scroller.clientWidth)
			: scroller.scrollWidth;
	}, [grid.year, currentWeek]);

	// Pulse today's square when its completed count goes up.
	const todayCompleted = todayCell?.completed;
	const previousCompleted = useRef(todayCompleted);
	useEffect(() => {
		const before = previousCompleted.current;
		previousCompleted.current = todayCompleted;
		if (reducedMotion || before === undefined || todayCompleted === undefined)
			return;
		if (todayCompleted > before) {
			pulse(scrollerRef.current?.querySelector('[aria-current="date"]'));
		}
	}, [todayCompleted, reducedMotion]);

	const linkOf = (date: string | undefined) =>
		date === undefined
			? null
			: scrollerRef.current?.querySelector<HTMLElement>(
					`[data-date="${date}"]`
				);

	const showTooltip = (element: Element) => {
		const container = containerRef.current;
		const date = (element as HTMLElement).dataset.date;
		const cell = date === undefined ? undefined : cells[indexOf.get(date)!];
		if (!container || !cell) return;
		const box = container.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		const center = rect.left + rect.width / 2 - box.left;
		setTooltip({
			cell,
			x: Math.min(
				Math.max(center, TOOLTIP_HALF_WIDTH),
				Math.max(TOOLTIP_HALF_WIDTH, box.width - TOOLTIP_HALF_WIDTH)
			),
			y: rect.top - box.top,
		});
	};

	const onPointerOver = (event: PointerEvent) => {
		// On touch screens a tap opens the day; no tooltip.
		if (event.pointerType === "touch") return;
		const element = (event.target as Element).closest("[data-date]");
		if (element) showTooltip(element);
		else setTooltip(null);
	};

	const onFocus = (event: FocusEvent) => {
		const date = (event.target as HTMLElement).dataset.date;
		if (date === undefined) return;
		setActiveDate(date);
		showTooltip(event.target);
	};

	const onBlur = (event: FocusEvent) => {
		if (!event.currentTarget.contains(event.relatedTarget)) setTooltip(null);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		stopEntrance();
		const date = (event.target as HTMLElement).dataset.date;
		const from = date === undefined ? undefined : indexOf.get(date);
		if (from === undefined) return;
		const next = nextCellIndex(navigable, from, event.key);
		if (next === null) {
			// Keep arrows from scrolling the page at the edges of the grid.
			if (event.key.startsWith("Arrow")) event.preventDefault();
			return;
		}
		event.preventDefault();
		linkOf(cells[next]!.date)?.focus();
	};

	return (
		<div ref={containerRef} className="relative">
			<div
				ref={scrollerRef}
				className="relative touch-manipulation overflow-x-auto overscroll-x-contain scroll-pl-10 pt-1 pb-3"
				onScroll={() => setTooltip(null)}
				onWheel={stopEntrance}
				onPointerDown={stopEntrance}
			>
				<div
					role="grid"
					aria-label={`Histórico de ${grid.year}`}
					aria-rowcount={7}
					aria-colcount={grid.weeks.length + 1}
					data-animate={animate ? "" : undefined}
					className="inline-flex flex-col gap-1"
					onKeyDown={onKeyDown}
					onFocus={onFocus}
					onBlur={onBlur}
					onPointerOver={onPointerOver}
					onPointerLeave={() => setTooltip(null)}
				>
					<div aria-hidden="true" className="flex gap-1">
						<div
							className={cn(
								WEEKDAY_COLUMN,
								"sticky left-0 z-10 shrink-0 bg-night-bg after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-3 after:bg-linear-to-r after:from-night-bg after:to-transparent"
							)}
						/>
						{grid.weeks.map((week, index) => {
							const month = labels.get(index);
							return (
								<div
									key={week.start}
									className="relative h-5 w-touch shrink-0 md:w-7"
								>
									{month !== undefined && (
										<span className="absolute left-0 font-display text-xs font-semibold whitespace-nowrap text-night-subtle capitalize">
											{monthShortName(month)}
										</span>
									)}
								</div>
							);
						})}
					</div>

					{WEEKDAYS.map((weekday) => (
						<div key={weekday} role="row" className="flex gap-1">
							<div
								role="rowheader"
								className={cn(
									WEEKDAY_COLUMN,
									"sticky left-0 z-10 flex h-touch shrink-0 items-center bg-night-bg text-xs font-medium text-night-subtle md:h-7 after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-3 after:bg-linear-to-r after:from-night-bg after:to-transparent"
								)}
							>
								<span aria-hidden="true">{weekdayInitial(weekday)}</span>
								<span className="sr-only">{weekdayName(weekday)}</span>
							</div>
							{grid.weeks.map((week, index) => {
								const cell: GridCell = week.days[weekday]!;
								return (
									<HeatmapCell
										key={cell.date}
										cell={cell}
										col={index}
										step={Math.max(0, anchor - index)}
										tabbable={cell.date === tabStop}
										currentWeek={index === currentWeek}
									/>
								);
							})}
						</div>
					))}
				</div>
			</div>
			<HeatmapTooltip target={tooltip} />
		</div>
	);
}
