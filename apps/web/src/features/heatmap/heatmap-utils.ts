import type { GridCell, HeatmapLevel } from "@habits/core";
import { formatFullDate, formatPercent } from "@/lib/format.ts";

// Literal class names so Tailwind generates them (no string building).
export const LEVEL_CLASSES: Record<HeatmapLevel, string> = {
	0: "bg-heatmap-0 border-heatmap-0-border",
	1: "bg-heatmap-1 border-heatmap-1-border",
	2: "bg-heatmap-2 border-heatmap-2-border",
	3: "bg-heatmap-3 border-heatmap-3-border",
	4: "bg-heatmap-4 border-heatmap-4-border",
	5: "bg-heatmap-5 border-heatmap-5-border",
};

/** 44px touch targets on phones, GitHub-sized squares from `md` up. */
export const CELL_SIZE = "size-touch md:size-6";

/** "9 de outubro de 2026: 3 de 5 hábitos concluídos (60%)" */
export function cellLabel(cell: GridCell): string {
	const date = formatFullDate(cell.date);
	const today = cell.relation === "today" ? " (hoje)" : "";
	if (cell.possible === 0) return `${date}${today}: nenhum hábito previsto`;
	return `${date}${today}: ${cell.completed} de ${cell.possible} hábitos concluídos (${formatPercent(cell.ratio)})`;
}

/**
 * Where to scroll so the column sits near the right edge with some weeks
 * after it visible (GitHub-like: recent history on screen).
 */
export function scrollLeftFor(
	column: Pick<HTMLElement, "offsetLeft" | "offsetWidth">,
	viewportWidth: number
): number {
	const target = column.offsetLeft + column.offsetWidth - viewportWidth * 0.8;
	return Math.max(0, Math.round(target));
}
