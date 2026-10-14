import { HEATMAP_LEVEL_COUNT, type HeatmapLevel } from "@habits/core";
import { cn } from "@/lib/utils.ts";
import { LEVEL_CLASSES, PREVIEW_CLASSES } from "./heatmap-utils.ts";

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
		<div className="flex items-center gap-2 text-xs text-night-subtle">
			<span aria-hidden="true">Menos</span>
			<ul aria-label="Legenda de intensidade" className="flex gap-1">
				{LEVELS.map((level) => (
					<li
						key={level}
						title={LEVEL_DESCRIPTIONS[level]}
						className={cn("size-3.5 rounded-[4px]", LEVEL_CLASSES[level])}
					>
						<span className="sr-only">
							Nível {level}: {LEVEL_DESCRIPTIONS[level]}
						</span>
					</li>
				))}
			</ul>
			<span aria-hidden="true">Mais</span>
			{/* 2.14.0: the preview days, by shape and word (never color alone). */}
			<span className="ml-2 flex items-center gap-1.5">
				<span
					aria-hidden="true"
					className={cn("size-3.5 rounded-[4px]", PREVIEW_CLASSES)}
				/>
				Futuro
			</span>
		</div>
	);
}
