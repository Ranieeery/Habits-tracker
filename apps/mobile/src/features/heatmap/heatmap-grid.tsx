import { nightColors } from "@habits/design-tokens";
import type { GridCell, GridWeek, YearGrid } from "@habits/core";
import { monthLabels } from "@habits/core";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	FlatList,
	type GestureResponderEvent,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { withAlpha } from "@/lib/color.ts";
import { monthShortName, weekdayInitial } from "@/lib/format.ts";
import { pulse, release } from "@/ui/motion.ts";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";
import {
	CELL_PITCH,
	CELL_SIZE,
	canOpen,
	dayIndexAt,
	dayValue,
	defaultDayIndex,
	GRID_HEIGHT,
	hasGlow,
	initialWeekIndex,
	levelFill,
	MONTH_ROW_HEIGHT,
	stepDay,
	SWEEP_CELL_MS,
	sweepDelay,
	sweepDuration,
	visibleWeekCount,
	WEEKDAY_COLUMN_WIDTH,
	weekLabel,
	weekSignature,
} from "./heatmap-layout.ts";

/** Horizontal padding of the screen around the grid. */
const SCREEN_PADDING = 16;
/** Tiny grid labels may grow with the system font, but not past the slot. */
const LABEL_MAX_SCALE = 1.25;

/**
 * GitHub-style year grid for one hand: one column per week (Sunday on top),
 * 28 dp days in 32 dp slots, scrolling horizontally and opening on the
 * current week. Each week is one touch target and one accessibility element
 * (53, not 365): a tap opens the day under the finger (highlighted while
 * pressed); TalkBack reads the week, swipes up/down pick a day and a double
 * tap opens it.
 */
export function HeatmapGrid({
	grid,
	onOpenDay,
}: {
	grid: YearGrid;
	onOpenDay: (cell: GridCell) => void;
}) {
	const { width } = useWindowDimensions();
	const viewport = width - SCREEN_PADDING * 2 - WEEKDAY_COLUMN_WIDTH;
	const visibleWeeks = visibleWeekCount(viewport);
	const initialIndex = initialWeekIndex({
		todayWeekIndex: grid.today_week_index,
		weekCount: grid.weeks.length,
		visibleWeeks,
	});
	const sweepFrom = grid.today_week_index ?? grid.weeks.length - 1;
	const reduced = useReducedMotion();
	const sweep = useSweep(grid.year, grid.weeks.length, sweepFrom, reduced);
	const labels = useMemo(() => {
		const byWeek = new Map<number, string>();
		for (const label of monthLabels(grid)) {
			byWeek.set(label.week_index, monthShortName(label.month));
		}
		return byWeek;
	}, [grid]);

	return (
		<View className="flex-row" style={{ height: GRID_HEIGHT }}>
			<WeekdayLabels />
			<FlatList
				// A new list per year, so initialScrollIndex applies again.
				key={grid.year}
				horizontal
				data={grid.weeks}
				keyExtractor={(week) => week.start}
				renderItem={({ item, index }) => (
					<WeekColumn
						week={item}
						delay={sweepDelay(index, sweepFrom)}
						monthLabel={labels.get(index)}
						elapsed={sweep.elapsed}
						reduced={reduced}
						onTouch={sweep.finish}
						onOpenDay={onOpenDay}
					/>
				)}
				getItemLayout={(_, index) => ({
					length: CELL_PITCH,
					offset: CELL_PITCH * index,
					index,
				})}
				initialScrollIndex={initialIndex}
				initialNumToRender={visibleWeeks + 2}
				maxToRenderPerBatch={8}
				windowSize={5}
				onScrollBeginDrag={sweep.finish}
				showsHorizontalScrollIndicator={false}
				accessibilityLabel={`Mapa de hábitos de ${grid.year}`}
			/>
		</View>
	);
}

/**
 * Entrance sweep (DESIGN.md "Movimento"): one clock on the UI thread from 0
 * to the end; each column derives its own fade from it. Once per year shown,
 * finished at once by any touch or scroll, absent with reduced motion.
 */
function useSweep(
	year: number,
	weekCount: number,
	from: number,
	reduced: boolean
) {
	const total = sweepDuration(weekCount, from);
	const elapsed = useSharedValue(reduced ? total : 0);
	const ran = useRef<number | null>(null);
	useEffect(() => {
		if (reduced) {
			cancelAnimation(elapsed);
			elapsed.set(total);
			return;
		}
		if (ran.current === year) return;
		ran.current = year;
		elapsed.set(0);
		elapsed.set(withTiming(total, { duration: total, easing: Easing.linear }));
	}, [year, total, reduced, elapsed]);
	const finish = () => {
		cancelAnimation(elapsed);
		elapsed.set(total);
	};
	return { elapsed, finish };
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
					<Text
						maxFontSizeMultiplier={LABEL_MAX_SCALE}
						className="text-xs font-medium text-night-subtle"
					>
						{weekdayInitial(weekday)}
					</Text>
				</View>
			))}
		</View>
	);
}

interface WeekColumnProps {
	week: GridWeek;
	delay: number;
	monthLabel: string | undefined;
	elapsed: SharedValue<number>;
	reduced: boolean;
	onTouch: () => void;
	onOpenDay: (cell: GridCell) => void;
}

const WeekColumn = memo(
	function WeekColumn({
		week,
		delay,
		monthLabel,
		elapsed,
		reduced,
		onTouch,
		onOpenDay,
	}: WeekColumnProps) {
		const [pressed, setPressed] = useState<number | null>(null);
		// The day a screen reader is on (swipe up/down changes it).
		const [chosen, setChosen] = useState(() => defaultDayIndex(week));
		const openable = week.days.some((day) => canOpen(day));

		const fade = useAnimatedStyle(() => {
			const t = Math.min(
				1,
				Math.max(0, (elapsed.get() - delay) / SWEEP_CELL_MS)
			);
			return { opacity: t, transform: [{ translateY: (1 - t) * 4 }] };
		});

		const at = (event: GestureResponderEvent) => {
			const index = dayIndexAt(event.nativeEvent.locationY);
			return index !== null && canOpen(week.days[index]) ? index : null;
		};
		const open = (index: number | null) => {
			const cell = index === null ? undefined : week.days[index];
			if (cell && canOpen(cell)) onOpenDay(cell);
		};
		const onAccessibilityAction = (event: AccessibilityActionEvent) => {
			const action = event.nativeEvent.actionName;
			if (action === "increment") setChosen(stepDay(week, chosen, 1));
			else if (action === "decrement") setChosen(stepDay(week, chosen, -1));
			else if (action === "activate") open(chosen);
		};

		return (
			<Pressable
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={weekLabel(week)}
				accessibilityValue={{ text: dayValue(week, chosen) }}
				accessibilityHint={
					openable
						? "Deslize para cima ou para baixo para escolher o dia; toque duas vezes para abrir"
						: undefined
				}
				accessibilityState={{ disabled: !openable }}
				accessibilityActions={[
					{ name: "increment" },
					{ name: "decrement" },
					{ name: "activate" },
				]}
				onAccessibilityAction={onAccessibilityAction}
				disabled={!openable}
				onPressIn={(event) => {
					onTouch();
					setPressed(at(event));
				}}
				onPressOut={() => setPressed(null)}
				onPress={(event) => open(at(event))}
				style={styles.column}
			>
				<Animated.View style={[styles.columnInner, fade]}>
					<View style={styles.monthRow}>
						{monthLabel ? (
							<Text
								numberOfLines={1}
								maxFontSizeMultiplier={LABEL_MAX_SCALE}
								style={styles.monthLabel}
								className="text-xs font-medium text-night-subtle capitalize"
							>
								{monthLabel}
							</Text>
						) : null}
					</View>
					{week.days.map((cell, index) => (
						<DayCell
							key={cell.date}
							cell={cell}
							pressed={pressed === index}
							reduced={reduced}
						/>
					))}
				</Animated.View>
			</Pressable>
		);
	},
	// `onTouch` only finishes the sweep (same clock for the whole year), so a
	// new function each render is not a reason to redraw 53 columns.
	(prev, next) =>
		prev.delay === next.delay &&
		prev.monthLabel === next.monthLabel &&
		prev.reduced === next.reduced &&
		prev.elapsed === next.elapsed &&
		prev.onOpenDay === next.onOpenDay &&
		weekSignature(prev.week) === weekSignature(next.week)
);

function DayCell({
	cell,
	pressed,
	reduced,
}: {
	cell: GridCell;
	pressed: boolean;
	reduced: boolean;
}) {
	if (!cell.in_year) return <View style={styles.slot} />;
	if (cell.relation === "today") {
		return <TodayCell cell={cell} pressed={pressed} reduced={reduced} />;
	}
	return (
		<View style={styles.slot}>
			<View
				style={[
					styles.cell,
					{ backgroundColor: levelFill(cell.level) },
					cell.level === 0 && styles.empty,
					hasGlow(cell.level) && styles.glow,
					cell.relation === "future" && styles.future,
					pressed && styles.pressed,
				]}
			/>
		</View>
	);
}

/** Today: a ring; pulses when a habit gets done, dips when one is undone. */
function TodayCell({
	cell,
	pressed,
	reduced,
}: {
	cell: GridCell;
	pressed: boolean;
	reduced: boolean;
}) {
	const scale = useSharedValue(1);
	const previous = useRef(cell.completed);
	useEffect(() => {
		const before = previous.current;
		previous.current = cell.completed;
		if (reduced || cell.completed === before) return;
		(cell.completed > before ? pulse : release)(scale);
	}, [cell.completed, reduced, scale]);
	const pulseStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));

	return (
		<View style={styles.slot}>
			<Animated.View
				style={[
					styles.cell,
					{ backgroundColor: levelFill(cell.level) },
					hasGlow(cell.level) && styles.glow,
					styles.today,
					pressed && styles.pressed,
					pulseStyle,
				]}
			/>
		</View>
	);
}

const SLOT_INSET = (CELL_PITCH - CELL_SIZE) / 2;

const styles = StyleSheet.create({
	column: { width: CELL_PITCH, height: GRID_HEIGHT },
	columnInner: { pointerEvents: "none" },
	monthRow: { height: MONTH_ROW_HEIGHT },
	// Wider than its column so "set" fits; the next columns have no label.
	monthLabel: { width: CELL_PITCH * 2, marginLeft: SLOT_INSET },
	slot: {
		width: CELL_PITCH,
		height: CELL_PITCH,
		alignItems: "center",
		justifyContent: "center",
	},
	cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 6 },
	empty: { borderWidth: 1, borderColor: nightColors.border.strong },
	glow: { boxShadow: `0 0 8px ${withAlpha(nightColors.glow, 0.55)}` },
	today: { borderWidth: 2, borderColor: nightColors.foreground },
	future: { opacity: 0.4 },
	pressed: { borderWidth: 2, borderColor: nightColors.accent.text },
});
