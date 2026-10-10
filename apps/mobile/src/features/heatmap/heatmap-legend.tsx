import { HEATMAP_LEVEL_COUNT, type HeatmapLevel } from "@habits/core";
import { Text, View } from "react-native";
import { levelColors } from "./heatmap-layout.ts";

const LEVELS = Array.from(
	{ length: HEATMAP_LEVEL_COUNT },
	(_, level) => level as HeatmapLevel
);

export function HeatmapLegend() {
	return (
		<View
			accessible
			accessibilityLabel="Legenda: as cores vão de nenhum hábito concluído, à esquerda, a todos concluídos, à direita"
			className="flex-row items-center gap-2"
		>
			<Text className="text-xs text-muted">Menos</Text>
			{LEVELS.map((level) => {
				const { fill, border } = levelColors(level);
				return (
					<View
						key={level}
						style={{
							width: 16,
							height: 16,
							borderRadius: 4,
							borderWidth: 2,
							backgroundColor: fill,
							borderColor: border,
						}}
					/>
				);
			})}
			<Text className="text-xs text-muted">Mais</Text>
		</View>
	);
}
