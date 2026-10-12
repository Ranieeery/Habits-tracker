/**
 * The 2.4.0 mark: four heatmap squares climbing in intensity, and the name in
 * the display face. Decorative: the link around it carries the name.
 */
export function Wordmark() {
	return (
		<span aria-hidden="true" translate="no" className="flex items-center gap-2">
			<svg viewBox="0 0 20 20" className="size-6" focusable="false">
				<rect
					x="0"
					y="11"
					width="9"
					height="9"
					rx="2.5"
					className="fill-night-heat-2"
				/>
				<rect
					x="11"
					y="11"
					width="9"
					height="9"
					rx="2.5"
					className="fill-night-heat-3"
				/>
				<rect
					x="0"
					y="0"
					width="9"
					height="9"
					rx="2.5"
					className="fill-night-heat-4"
				/>
				<rect
					x="11"
					y="0"
					width="9"
					height="9"
					rx="2.5"
					className="fill-night-heat-5"
				/>
			</svg>
			<span className="font-display text-xl font-bold tracking-tight text-night-foreground">
				Habits
			</span>
		</span>
	);
}
