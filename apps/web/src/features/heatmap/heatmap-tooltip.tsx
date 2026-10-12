import type { GridCell } from "@habits/core";
import { tooltipText } from "./heatmap-utils.ts";

export interface TooltipTarget {
	cell: GridCell;
	/** Center of the cell, relative to the tooltip's positioned container. */
	x: number;
	/** Top of the cell, relative to the same container. */
	y: number;
}

/**
 * The one tooltip of the grid (shared by every cell instead of one per day),
 * shown on hover and keyboard focus. Hidden from assistive technology: each
 * cell's `aria-label` already says the same.
 */
export function HeatmapTooltip({ target }: { target: TooltipTarget | null }) {
	if (!target) return null;
	const { title, detail } = tooltipText(target.cell);
	return (
		<div
			aria-hidden="true"
			data-heatmap-tooltip=""
			style={{
				transform: `translate(${Math.round(target.x)}px, ${Math.round(target.y - 8)}px) translate(-50%, -100%)`,
			}}
			className="pointer-events-none absolute top-0 left-0 z-20 rounded-md border border-night-border bg-night-surface-overlay px-3 py-2 text-xs whitespace-nowrap shadow-lg shadow-night-bg/60 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0"
		>
			<p className="font-semibold text-night-foreground first-letter:uppercase">
				{title}
			</p>
			<p className="text-night-muted tabular-nums">{detail}</p>
		</div>
	);
}
