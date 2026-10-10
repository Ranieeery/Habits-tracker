import { colors } from "@habits/design-tokens";
import type { GridCell, GridWeek, YearGrid } from "@habits/core";
import { monthLabels } from "@habits/core";
import { memo, useMemo } from "react";
import {
	FlatList,
	Pressable,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { monthShortName, weekdayInitial } from "@/lib/format.ts";
import {
	CELL_PITCH,
	CELL_SIZE,
	cellLabel,
	initialWeekIndex,
	levelColors,
	MONTH_ROW_HEIGHT,
	visibleWeekCount,
	WEEKDAY_COLUMN_WIDTH,
} from "./heatmap-layout.ts";

/** Horizontal padding of the screen around the grid. */
const SCREEN_PADDING = 16;

/**
 * GitHub-style year grid: one column per week (Sunday on top), scrolling
 * horizontally and opening on the current week. Virtualized by week, and each
 * day stays its own accessible, 44 dp touch target.
 */
export function HeatmapGrid({
	grid,
	onPressDay,
}: {
	grid: YearGrid;
	onPressDay: (cell: GridCell) => void;
}) {
	const { width } = useWindowDimensions();
	const viewport = width - SCREEN_PADDING * 2 - WEEKDAY_COLUMN_WIDTH;
	const initialIndex = initialWeekIndex({
		todayWeekIndex: grid.today_week_index,
		weekCount: grid.weeks.length,
		visibleWeeks: visibleWeekCount(viewport),
	});
	const labels = useMemo(() => {
		const byWeek = new Map<number, string>();
		for (const label of monthLabels(grid)) {
			byWeek.set(label.week_index, monthShortName(label.month));
		}
		return byWeek;
	}, [grid]);

	return (
		<View className="flex-row">
			<WeekdayLabels />
			<FlatList
				horizontal
				data={grid.weeks}
				keyExtractor={(week) => week.start}
				renderItem={({ item, index }) => (
					<WeekColumn
						week={item}
						monthLabel={labels.get(index)}
						onPressDay={onPressDay}
					/>
				)}
				getItemLayout={(_, index) => ({
					length: CELL_PITCH,
					offset: CELL_PITCH * index,
					index,
				})}
				initialScrollIndex={initialIndex}
				initialNumToRender={visibleWeekCount(viewport) + 2}
				windowSize={5}
				showsHorizontalScrollIndicator={false}
				accessibilityLabel={`Mapa de hábitos de ${grid.year}`}
			/>
		</View>
	);
}

function WeekdayLabels() {
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			style={{ width: WEEKDAY_COLUMN_WIDTH, paddingTop: MONTH_ROW_HEIGHT }}
		>
			{[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
				<View
					key={weekday}
					style={{ height: CELL_PITCH }}
					className="justify-center"
				>
					<Text className="text-xs font-semibold text-muted">
						{weekdayInitial(weekday)}
					</Text>
				</View>
			))}
		</View>
	);
}

const WeekColumn = memo(function WeekColumn({
	week,
	monthLabel,
	onPressDay,
}: {
	week: GridWeek;
	monthLabel: string | undefined;
	onPressDay: (cell: GridCell) => void;
}) {
	return (
		<View style={{ width: CELL_PITCH }}>
			<View style={{ height: MONTH_ROW_HEIGHT }}>
				{monthLabel ? (
					<Text
						importantForAccessibility="no"
						numberOfLines={1}
						style={{ width: CELL_PITCH * 2 }}
						className="text-xs font-semibold text-muted capitalize"
					>
						{monthLabel}
					</Text>
				) : null}
			</View>
			{week.days.map((cell) => (
				<DayCell key={cell.date} cell={cell} onPress={onPressDay} />
			))}
		</View>
	);
});

function DayCell({
	cell,
	onPress,
}: {
	cell: GridCell;
	onPress: (cell: GridCell) => void;
}) {
	if (!cell.in_year) {
		return <View style={{ width: CELL_PITCH, height: CELL_PITCH }} />;
	}
	const { fill, border } = levelColors(cell.level);
	const future = cell.relation === "future";
	const today = cell.relation === "today";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={cellLabel(cell)}
			accessibilityState={{ disabled: future, selected: today }}
			disabled={future}
			onPress={() => onPress(cell)}
			style={({ pressed }) => ({
				width: CELL_PITCH,
				height: CELL_PITCH,
				alignItems: "center",
				justifyContent: "center",
				opacity: future ? 0.35 : pressed ? 0.7 : 1,
			})}
		>
			<View
				style={{
					width: CELL_SIZE,
					height: CELL_SIZE,
					borderRadius: 8,
					borderWidth: 2,
					backgroundColor: fill,
					borderColor: today ? colors.foreground : border,
				}}
			/>
		</Pressable>
	);
}
