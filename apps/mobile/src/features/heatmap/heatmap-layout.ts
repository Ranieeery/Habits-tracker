// Pure layout, touch and labelling for the heatmap. The grid itself (weeks,
// levels, month starts) comes from @habits/core.
import { nightColors } from "@habits/design-tokens";
import type { GridCell, GridWeek, HeatmapLevel } from "@habits/core";
import {
	formatCompactDate,
	formatDayMonth,
	formatFullDate,
	formatPercent,
	weekdayName,
} from "@/lib/format.ts";

/** Visible square of a day (DESIGN.md "Mobile": 28 dp, like the web on md). */
export const CELL_SIZE = 28;
/**
 * One day's slot: the square plus the gap. Touch areas are whole slots, so
 * neighbors touch without a dead gap between them.
 */
export const CELL_PITCH = 32;
/** Height of the month label row above the columns. */
export const MONTH_ROW_HEIGHT = 20;
/** Width of the fixed weekday label column. */
export const WEEKDAY_COLUMN_WIDTH = 20;
/** Height of the whole grid (month row plus seven days). */
export const GRID_HEIGHT = MONTH_ROW_HEIGHT + CELL_PITCH * 7;

/** Entrance sweep (DESIGN.md "Movimento"): per column, then per step. */
export const SWEEP_CELL_MS = 220;
export const SWEEP_COLUMN_DELAY_MS = 6;

export function levelFill(level: HeatmapLevel): string {
	return nightColors.heat[level];
}

/** Levels 4 and 5 get the static glow. */
export function hasGlow(level: HeatmapLevel): boolean {
	return level >= 4;
}

/** How many week columns fit entirely in the viewport (at least 1). */
export function visibleWeekCount(viewportWidth: number): number {
	return Math.max(1, Math.floor(viewportWidth / CELL_PITCH));
}

/**
 * First week column to show so the current week sits near the right edge with
 * `trailingWeeks` of the future after it (GitHub-like: recent history on
 * screen). Without a current week (another year), shows the end of the year.
 */
export function initialWeekIndex({
	todayWeekIndex,
	weekCount,
	visibleWeeks,
	trailingWeeks = 1,
}: {
	todayWeekIndex: number | null;
	weekCount: number;
	visibleWeeks: number;
	trailingWeeks?: number;
}): number {
	const last = Math.max(0, weekCount - visibleWeeks);
	if (todayWeekIndex === null) return last;
	const start = todayWeekIndex + trailingWeeks - visibleWeeks + 1;
	return Math.min(last, Math.max(0, start));
}

/**
 * The weekday row (0 = Sunday) under a touch `y` pixels from the top of a
 * week column, or null over the month labels or below the grid.
 */
export function dayIndexAt(y: number): number | null {
	if (y < MONTH_ROW_HEIGHT) return null;
	const index = Math.floor((y - MONTH_ROW_HEIGHT) / CELL_PITCH);
	return index >= 0 && index < 7 ? index : null;
}

/**
 * A day opens its day screen: a drawn day that is not in the future, or a
 * preview day (2.14.0, read only).
 */
export function canOpen(
	cell: Pick<GridCell, "shown" | "preview" | "relation"> | undefined
): boolean {
	return (
		cell !== undefined &&
		cell.shown &&
		(cell.relation !== "future" || cell.preview)
	);
}

/**
 * Everything a week column draws or reads aloud, as one string: a column
 * re-renders only when this changes (`buildYearGrid` builds new objects for
 * every week whenever the summary changes).
 */
export function weekSignature(week: GridWeek): string {
	return week.days
		.map(
			(day) =>
				`${day.shown ? 1 : 0}${day.preview ? 1 : 0}${day.relation[0]}${day.level}:${day.completed}/${day.possible}`
		)
		.join(",");
}

/**
 * "9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"; a preview
 * day: "20 de outubro, dia futuro, toque para ver o que está programado".
 */
export function cellLabel(
	cell: Pick<
		GridCell,
		"date" | "relation" | "preview" | "completed" | "possible" | "ratio"
	>
): string {
	if (cell.preview) {
		return `${formatDayMonth(cell.date)}, dia futuro, toque para ver o que está programado`;
	}
	const date = formatFullDate(cell.date);
	const today = cell.relation === "today" ? " (hoje)" : "";
	if (cell.relation === "future") return `${date}: dia futuro`;
	if (cell.possible === 0) return `${date}${today}: nenhum hábito previsto`;
	return `${date}${today}: ${cell.completed} de ${cell.possible} hábitos concluídos (${formatPercent(cell.ratio)})`;
}

/** "Semana de 4 a 10 de outubro", "Semana de 27 de setembro a 3 de outubro" */
export function weekLabel(week: GridWeek): string {
	const days = week.days.filter((day) => day.shown);
	const first = days[0]?.date ?? week.start;
	const last = days.at(-1)?.date ?? week.start;
	if (first === last) return `Semana de ${formatDayMonth(first)}`;
	const sameMonth = first.slice(0, 7) === last.slice(0, 7);
	const from = sameMonth
		? String(Number(first.slice(8)))
		: formatDayMonth(first);
	return `Semana de ${from} a ${formatDayMonth(last)}`;
}

/** What a screen reader says for the chosen day of a week column. */
export function dayValue(week: GridWeek, index: number): string {
	const cell = week.days[index];
	if (!cell) return "";
	return `${weekdayName(index)}, ${cellLabel(cell)}`;
}

/**
 * The day a week column offers first to a screen reader: today, else the
 * last day that can be opened, else the first day of the year in it.
 */
export function defaultDayIndex(week: GridWeek): number {
	const today = week.days.findIndex((day) => day.relation === "today");
	if (today >= 0) return today;
	for (let i = week.days.length - 1; i >= 0; i--) {
		if (canOpen(week.days[i])) return i;
	}
	return Math.max(
		0,
		week.days.findIndex((day) => day.shown)
	);
}

/**
 * The next day that can be opened from `index` in `direction` (screen reader
 * swipe up/down on the week), or `index` when there is none.
 */
export function stepDay(
	week: GridWeek,
	index: number,
	direction: 1 | -1
): number {
	for (
		let i = index + direction;
		i >= 0 && i < week.days.length;
		i += direction
	) {
		if (canOpen(week.days[i])) return i;
	}
	return index;
}

/** Entrance delay of a column: the current week first, then outwards. */
export function sweepDelay(weekIndex: number, startIndex: number): number {
	return Math.abs(startIndex - weekIndex) * SWEEP_COLUMN_DELAY_MS;
}

/** When the sweep of `weekCount` columns from `startIndex` is over. */
export function sweepDuration(weekCount: number, startIndex: number): number {
	const farthest = Math.max(startIndex, weekCount - 1 - startIndex, 0);
	return farthest * SWEEP_COLUMN_DELAY_MS + SWEEP_CELL_MS;
}

/** A day of the grid by position: week column and weekday row. */
export interface GridPoint {
	weekIndex: number;
	dayIndex: number;
}

/**
 * The day under a point of the scrolling list (2.10.0 day preview): `x` and
 * `y` from the list's top-left corner, `scrollX` its horizontal offset.
 * Null over the month labels, outside the weeks, or on a day that cannot be
 * opened (outside the year, or in the future beyond the preview).
 */
export function cellAt(
	x: number,
	y: number,
	scrollX: number,
	weeks: readonly GridWeek[]
): GridPoint | null {
	const dayIndex = dayIndexAt(y);
	if (dayIndex === null || x < 0) return null;
	const weekIndex = Math.floor((x + scrollX) / CELL_PITCH);
	const cell = weeks[weekIndex]?.days[dayIndex];
	return canOpen(cell) ? { weekIndex, dayIndex } : null;
}

/**
 * The two lines of the day preview: "qui, 8 de out" and "3 de 5 · 60%"; a
 * preview day (2.14.0) says only "Dia futuro" (nothing about its content).
 */
export function previewLines(
	cell: Pick<
		GridCell,
		"date" | "relation" | "preview" | "completed" | "possible" | "ratio"
	>,
	{ filtered }: { filtered: boolean }
): { title: string; detail: string } {
	const title = `${formatCompactDate(cell.date)}${cell.relation === "today" ? " (hoje)" : ""}`;
	if (cell.preview) return { title, detail: "Dia futuro" };
	if (filtered) {
		// One habit (the history filter): it was due that day or not.
		if (cell.possible === 0) return { title, detail: "Sem previsão" };
		return { title, detail: cell.completed > 0 ? "Feito" : "Não feito" };
	}
	if (cell.possible === 0) return { title, detail: "Nenhum hábito previsto" };
	return {
		title,
		detail: `${cell.completed} de ${cell.possible} · ${formatPercent(cell.ratio)}`,
	};
}

/**
 * Left edge of a box `width` wide centered on `centerX`, kept inside
 * `[0, containerWidth]` (a narrower container keeps it at 0).
 */
export function bubbleLeft(
	centerX: number,
	width: number,
	containerWidth: number
): number {
	const max = Math.max(0, containerWidth - width);
	return Math.min(max, Math.max(0, centerX - width / 2));
}
