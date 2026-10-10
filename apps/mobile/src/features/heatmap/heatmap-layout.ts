// Pure layout and labelling for the heatmap. The grid itself (weeks, levels,
// month starts) comes from @habits/core.
import { colors, TOUCH_TARGET_MIN } from "@habits/design-tokens";
import type { GridCell, HeatmapLevel } from "@habits/core";
import { formatFullDate, formatPercent } from "@/lib/format.ts";

/** Each day is a full touch target; the visible square sits inside it. */
export const CELL_PITCH = TOUCH_TARGET_MIN;
export const CELL_SIZE = 36;
/** Height of the month label row above the columns. */
export const MONTH_ROW_HEIGHT = 20;
/** Width of the fixed weekday label column. */
export const WEEKDAY_COLUMN_WIDTH = 24;

export interface LevelColors {
	fill: string;
	border: string;
}

export function levelColors(level: HeatmapLevel): LevelColors {
	return {
		fill: colors.heatmap[level],
		border: colors.heatmap[`${level}-border`],
	};
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

/** "9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)" */
export function cellLabel(
	cell: Pick<GridCell, "date" | "relation" | "completed" | "possible" | "ratio">
): string {
	const date = formatFullDate(cell.date);
	const today = cell.relation === "today" ? " (hoje)" : "";
	if (cell.relation === "future") return `${date}: dia futuro`;
	if (cell.possible === 0) return `${date}${today}: nenhum hábito previsto`;
	return `${date}${today}: ${cell.completed} de ${cell.possible} hábitos concluídos (${formatPercent(cell.ratio)})`;
}
