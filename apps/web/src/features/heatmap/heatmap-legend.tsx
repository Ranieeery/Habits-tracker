import { HEATMAP_LEVEL_COUNT, type HeatmapLevel } from "@habits/core";
import { cn } from "@/lib/utils.ts";
import { LEVEL_CLASSES } from "./heatmap-utils.ts";

// Matches `heatmapLevel` in @habits/core: one level per 20%.
const LEVEL_DESCRIPTIONS: Record<HeatmapLevel, string> = {
	0: "nada concluído",
	1: "menos de 20%",
	2: "de 20% a 40%",
	3: "de 40% a 60%",
	4: "de 60% a 80%",
	5: "80% ou mais",
};

const LEVELS = Array.from(
	{ length: HEATMAP_LEVEL_COUNT },
	(_, level) => level as HeatmapLevel
);

export function HeatmapLegend() {
	return (
		<div className="flex flex-wrap items-center gap-2 text-xs text-muted">
			<span>0%</span>
			<ul aria-label="Legenda de intensidade" className="flex gap-1">
				{LEVELS.map((level) => (
					<li
						key={level}
						title={LEVEL_DESCRIPTIONS[level]}
						className={cn("size-4 rounded-sm border-2", LEVEL_CLASSES[level])}
					>
						<span className="sr-only">
							Nível {level}: {LEVEL_DESCRIPTIONS[level]}
						</span>
					</li>
				))}
			</ul>
			<span>100%</span>
		</div>
	);
}
