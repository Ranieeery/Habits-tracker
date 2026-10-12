import type { GridCell } from "@habits/core";
import { cn } from "@/lib/utils.ts";
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
 * shown on hover and keyboard focus. It travels with the lens (same 120 ms
 * glide; `jump` places it at once). Hidden from assistive technology: each
 * cell's `aria-label` already says the same.
 */
export function HeatmapTooltip({
	target,
	visible,
	jump,
}: {
	target: TooltipTarget | null;
	visible: boolean;
	jump: boolean;
}) {
	if (!target) return null;
	const { title, detail } = tooltipText(target.cell);
	return (
		<div
			aria-hidden="true"
			data-heatmap-tooltip=""
			data-visible={visible ? "" : undefined}
			style={{
				transform: `translate(${Math.round(target.x)}px, ${Math.round(target.y - 8)}px) translate(-50%, -100%)`,
			}}
			className={cn(
				"pointer-events-none absolute top-0 left-0 z-20 rounded-md border border-night-border bg-night-surface-overlay px-3 py-2 text-xs whitespace-nowrap shadow-lg shadow-night-bg/60",
				visible ? "opacity-100" : "opacity-0",
				!jump &&
					"motion-safe:transition-[transform,opacity] motion-safe:duration-120 motion-safe:ease-out"
			)}
		>
			<p className="font-semibold text-night-foreground first-letter:uppercase">
				{title}
			</p>
			<p className="text-night-muted tabular-nums">{detail}</p>
		</div>
	);
}
