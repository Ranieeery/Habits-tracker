import type { GridCell } from "@habits/core";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils.ts";
import { CELL_SIZE, cellLabel, LEVEL_CLASSES } from "./heatmap-utils.ts";

const BASE = cn(CELL_SIZE, "block shrink-0 rounded-md border-2");

export function HeatmapCell({ cell }: { cell: GridCell }) {
	// Days of the neighbor years only keep the grid aligned.
	if (!cell.in_year) {
		return <div aria-hidden="true" className={cn(CELL_SIZE, "shrink-0")} />;
	}

	// Like the legacy app, days that have not happened yet are placeholders.
	if (cell.relation === "future") {
		return (
			<div
				aria-hidden="true"
				data-relation="future"
				className={cn(BASE, LEVEL_CLASSES[0], "opacity-40")}
			/>
		);
	}

	const isToday = cell.relation === "today";
	const label = cellLabel(cell);
	return (
		<Link
			to="/day/$date"
			params={{ date: cell.date }}
			aria-label={label}
			title={label}
			data-level={cell.level}
			data-relation={cell.relation}
			aria-current={isToday ? "date" : undefined}
			className={cn(
				BASE,
				LEVEL_CLASSES[cell.level],
				"transition-transform hover:scale-110",
				isToday && "outline-2 outline-offset-2 outline-foreground"
			)}
		/>
	);
}
