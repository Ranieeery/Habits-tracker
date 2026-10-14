import type { GridCell } from "@habits/core";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils.ts";
import {
	CELL_SIZE,
	cellLabel,
	LEVEL_CLASSES,
	PREVIEW_CLASSES,
} from "./heatmap-utils.ts";

const SHAPE = cn(CELL_SIZE, "block shrink-0 rounded-md md:rounded-sm");

/**
 * One day of the grid: a `gridcell` holding a link to the day (past days,
 * today and the preview days), an inert square (the rest of the year's
 * future days), or nothing (padding of other years). Preview days
 * (2.14.0) are dashed outlines with no level: what is planned only shows on
 * the day screen. `tabbable` is the grid's roving tab stop; `step` orders
 * the entrance sweep (0 plays first).
 */
export function HeatmapCell({
	cell,
	col,
	step = 0,
	tabbable = false,
	currentWeek = false,
}: {
	cell: GridCell;
	col: number;
	step?: number;
	tabbable?: boolean;
	currentWeek?: boolean;
}) {
	const style = { "--step": step } as CSSProperties;
	const position = {
		"data-col": col,
		"data-current-week": currentWeek ? "" : undefined,
	};

	// Days of the neighbor years only keep the grid aligned.
	if (!cell.shown) {
		return (
			<div
				role="gridcell"
				{...position}
				className={cn(CELL_SIZE, "shrink-0")}
			/>
		);
	}

	// Future days after the preview (the rest of the year) stay placeholders,
	// like in the legacy app.
	if (cell.relation === "future" && !cell.preview) {
		return (
			<div role="gridcell" {...position} className="shrink-0">
				<div
					aria-hidden="true"
					data-relation="future"
					data-heat-cell=""
					style={style}
					className={cn(SHAPE, LEVEL_CLASSES[0], "opacity-40")}
				/>
			</div>
		);
	}

	const isToday = cell.relation === "today";
	return (
		<div role="gridcell" {...position} className="shrink-0">
			<Link
				to="/day/$date"
				params={{ date: cell.date }}
				aria-label={cellLabel(cell)}
				tabIndex={tabbable ? 0 : -1}
				data-date={cell.date}
				data-level={cell.preview ? undefined : cell.level}
				data-relation={cell.relation}
				data-preview={cell.preview ? "" : undefined}
				data-heat-cell=""
				aria-current={isToday ? "date" : undefined}
				style={style}
				className={cn(
					SHAPE,
					cell.preview ? PREVIEW_CLASSES : LEVEL_CLASSES[cell.level],
					// Hover and focus are marked by the grid's lens; the cell only
					// brightens (no motion of its own).
					"hover:brightness-125",
					isToday && "outline-2 outline-offset-2 outline-night-foreground"
				)}
			/>
		</div>
	);
}
