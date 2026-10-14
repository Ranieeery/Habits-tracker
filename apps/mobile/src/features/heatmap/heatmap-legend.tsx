import { nightColors } from "@habits/design-tokens";
import { HEATMAP_LEVEL_COUNT, type HeatmapLevel } from "@habits/core";
import { StyleSheet, Text, View } from "react-native";
import { levelFill } from "./heatmap-layout.ts";

const LEVELS = Array.from(
	{ length: HEATMAP_LEVEL_COUNT },
	(_, level) => level as HeatmapLevel
);

export function HeatmapLegend() {
	return (
		<View
			accessible
			accessibilityLabel="Legenda: as cores vão de nenhum hábito concluído, à esquerda, a todos concluídos, à direita. Quadrado tracejado: dia futuro"
			className="flex-row items-center gap-1.5 self-end"
		>
			<Text className="mr-1 text-xs text-night-subtle">Menos</Text>
			{LEVELS.map((level) => (
				<View
					key={level}
					style={[
						styles.swatch,
						{ backgroundColor: levelFill(level) },
						level === 0 && styles.empty,
					]}
				/>
			))}
			<Text className="ml-1 text-xs text-night-subtle">Mais</Text>
			{/* 2.14.0: the preview days, by shape and word (never color alone). */}
			<View style={[styles.swatch, styles.preview, styles.previewGap]} />
			<Text className="text-xs text-night-subtle">Futuro</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	swatch: { width: 12, height: 12, borderRadius: 3 },
	empty: { borderWidth: 1, borderColor: nightColors.border.strong },
	preview: {
		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: nightColors.subtle,
	},
	previewGap: { marginLeft: 8 },
});
