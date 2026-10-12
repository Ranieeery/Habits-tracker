import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { type ReactNode, useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { DataError, errorMessage } from "@/data/errors.ts";
import { Button } from "@/ui/button.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { useReducedMotion } from "@/ui/use-reduced-motion.ts";
import {
	CELL_PITCH,
	CELL_SIZE,
	GRID_HEIGHT,
	MONTH_ROW_HEIGHT,
	visibleWeekCount,
	WEEKDAY_COLUMN_WIDTH,
} from "./heatmap-layout.ts";

/** Slow opacity breathing for loading shapes; still with reduced motion. */
function Breathing({
	children,
	className,
}: {
	children?: ReactNode;
	className?: string;
}) {
	const reduced = useReducedMotion();
	const opacity = useSharedValue(1);
	useEffect(() => {
		if (reduced) {
			cancelAnimation(opacity);
			opacity.set(1);
			return;
		}
		opacity.set(
			withRepeat(
				withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
				-1,
				true
			)
		);
		return () => cancelAnimation(opacity);
	}, [reduced, opacity]);
	const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
	return (
		<Animated.View style={style}>
			<View className={className}>{children}</View>
		</Animated.View>
	);
}

/** A grey bar standing in for text while loading. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
	return <Breathing className={`bg-night-surface-raised ${className}`} />;
}

/** The grid's shape in level-0 cells, so the screen does not jump. */
export function HeatmapSkeleton({ width }: { width: number }) {
	const weeks = visibleWeekCount(width - WEEKDAY_COLUMN_WIDTH);
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel="Carregando…"
			style={{ height: GRID_HEIGHT, paddingLeft: WEEKDAY_COLUMN_WIDTH }}
		>
			<Breathing>
				<View className="flex-row" style={{ paddingTop: MONTH_ROW_HEIGHT }}>
					{Array.from({ length: weeks }, (_, week) => (
						<View key={week} style={{ width: CELL_PITCH }}>
							{Array.from({ length: 7 }, (_, day) => (
								<View
									key={day}
									style={{
										width: CELL_SIZE,
										height: CELL_SIZE,
										marginBottom: CELL_PITCH - CELL_SIZE,
										borderRadius: 6,
										backgroundColor: nightColors.heat[0],
									}}
								/>
							))}
						</View>
					))}
				</View>
			</Breathing>
		</View>
	);
}

/** No habits at all: an invitation instead of an empty year. */
export function HeatmapEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<View className="items-start gap-3 rounded-xl border border-night-border bg-night-surface p-5">
			<DisplayText weight="semibold" className="text-xl text-night-foreground">
				Seu ano começa aqui
			</DisplayText>
			<Text className="text-sm text-night-muted">
				Crie um hábito e cada dia feito acende um quadrado.
			</Text>
			<Button icon="plus" label="Criar primeiro hábito" onPress={onCreate} />
		</View>
	);
}

/** The year could not be read. */
export function HeatmapError({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	const offline = error instanceof DataError && error.kind === "offline";
	return (
		<View
			accessibilityRole="alert"
			className="items-start gap-3 rounded-xl border border-night-danger/40 bg-night-danger-surface p-5"
		>
			<View className="flex-row items-center gap-2">
				<MaterialCommunityIcons
					name={offline ? "cloud-off-outline" : "alert-circle-outline"}
					size={22}
					color={nightColors.danger.DEFAULT}
				/>
				<Text className="flex-1 text-base font-semibold text-night-foreground">
					Não foi possível carregar o ano
				</Text>
			</View>
			<Text className="text-sm text-night-muted">{errorMessage(error)}</Text>
			<Button variant="secondary" label="Tentar de novo" onPress={onRetry} />
		</View>
	);
}
