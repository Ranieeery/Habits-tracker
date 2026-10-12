import { cn } from "@/lib/utils.ts";

export interface LensBox {
	/** Offsets inside the scroller (it scrolls with the cells). */
	x: number;
	y: number;
	size: number;
}

/** How far the ring sits outside the cell. */
const GAP = 3;

/**
 * The one ring that marks the cell under the pointer or with keyboard focus.
 * It glides between cells (transform, 120 ms) instead of every cell scaling,
 * so a quick sweep reads as one calm movement. `jump` places it without the
 * glide (when it appears, or with reduced motion).
 */
export function HeatmapLens({
	box,
	visible,
	jump,
}: {
	box: LensBox | null;
	visible: boolean;
	jump: boolean;
}) {
	if (!box) return null;
	const size = box.size + GAP * 2;
	return (
		<div
			aria-hidden="true"
			data-heatmap-lens=""
			data-visible={visible ? "" : undefined}
			style={{
				width: size,
				height: size,
				transform: `translate(${box.x - GAP}px, ${box.y - GAP}px)`,
			}}
			className={cn(
				"pointer-events-none absolute top-0 left-0 z-[5] rounded-lg ring-2 ring-night-accent-text",
				visible ? "opacity-100" : "opacity-0",
				!jump &&
					"motion-safe:transition-[transform,opacity] motion-safe:duration-120 motion-safe:ease-out"
			)}
		/>
	);
}
