import type { GridCell, HeatmapLevel } from "@habits/core";
import {
	formatDayMonth,
	formatFullDate,
	formatLongDate,
	formatPercent,
} from "@/lib/format.ts";

// Literal class names so Tailwind generates them (no string building). Level
// 0 is outlined so empty days still read as cells; the two brightest levels
// glow softly (static shadow, never animated).
const GLOW =
	"shadow-[0_0_14px_-3px_color-mix(in_oklab,var(--color-night-glow)_70%,transparent)]";
export const LEVEL_CLASSES: Record<HeatmapLevel, string> = {
	0: "bg-night-heat-0 inset-ring inset-ring-night-border-strong",
	1: "bg-night-heat-1",
	2: "bg-night-heat-2",
	3: "bg-night-heat-3",
	4: `bg-night-heat-4 ${GLOW}`,
	5: `bg-night-heat-5 ${GLOW}`,
};

/**
 * A preview day (2.14.0): a dashed outline and no fill, never a level or any
 * hint of what is planned. `night-subtle` keeps the outline above 3:1 on the
 * page (`night-border-strong` is 1.9:1).
 */
export const PREVIEW_CLASSES =
	"border border-dashed border-night-subtle bg-transparent";

/** 44px touch targets on phones, 28px squares from `md` up. */
export const CELL_SIZE = "size-touch md:size-7";

/** Width of the sticky weekday column (kept out of the scroll padding). */
export const WEEKDAY_COLUMN = "w-8";

/**
 * "9 de outubro de 2026: 3 de 5 hábitos concluídos (60%)"; a preview day:
 * "20 de outubro, dia futuro, toque para ver o que está programado".
 */
export function cellLabel(cell: GridCell): string {
	if (cell.preview) {
		return `${formatDayMonth(cell.date)}, dia futuro, toque para ver o que está programado`;
	}
	const date = formatFullDate(cell.date);
	const today = cell.relation === "today" ? " (hoje)" : "";
	if (cell.possible === 0) return `${date}${today}: nenhum hábito previsto`;
	return `${date}${today}: ${cell.completed} de ${cell.possible} hábitos concluídos (${formatPercent(cell.ratio)})`;
}

/**
 * What the hover/focus tooltip shows: the day and "3 de 5 hábitos (60%)",
 * or for a preview day only "Dia futuro" (nothing about its content).
 */
export function tooltipText(cell: GridCell): { title: string; detail: string } {
	const title = `${formatLongDate(cell.date)}${cell.relation === "today" ? " (hoje)" : ""}`;
	if (cell.preview) return { title, detail: "Dia futuro" };
	if (cell.possible === 0) return { title, detail: "Nenhum hábito previsto" };
	return {
		title,
		detail: `${cell.completed} de ${cell.possible} ${cell.possible === 1 ? "hábito" : "hábitos"} (${formatPercent(cell.ratio)})`,
	};
}

/**
 * Cells that open a day (and that the keyboard reaches): past days and today
 * of the year, and the preview days.
 */
export function isNavigable(cell: GridCell): boolean {
	return cell.shown && (cell.relation !== "future" || cell.preview);
}

const STEPS: Record<string, number> = {
	ArrowLeft: -7,
	ArrowRight: 7,
	ArrowUp: -1,
	ArrowDown: 1,
};

/**
 * Keyboard movement in the grid. Cells are indexed in week order
 * (`week * 7 + weekday`), so ←/→ move a week and ↑/↓ a day, skipping cells
 * that cannot be focused (future days, other years); Home/End go to the
 * first/last reachable cell of the weekday row. Returns null to stay put.
 */
export function nextCellIndex(
	navigable: readonly boolean[],
	from: number,
	key: string
): number | null {
	const step = STEPS[key];
	if (step !== undefined) {
		for (let i = from + step; i >= 0 && i < navigable.length; i += step) {
			if (navigable[i]) return i;
		}
		return null;
	}
	if (key !== "Home" && key !== "End") return null;
	const weekday = from % 7;
	const weeks = Math.ceil(navigable.length / 7);
	for (let n = 0; n < weeks; n++) {
		const week = key === "Home" ? n : weeks - 1 - n;
		const i = week * 7 + weekday;
		if (navigable[i]) return i === from ? null : i;
	}
	return null;
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
