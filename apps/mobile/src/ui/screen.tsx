import { colors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { RefreshControl, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
	type Edge,
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";

/**
 * Scrolling page with safe-area padding. Focused inputs scroll above the
 * keyboard (Android is edge-to-edge, so `adjustResize` alone is not enough).
 * Tab screens pass `edges={["top"]}`; screens under a native header pass none.
 * `footer` stays fixed below the scroll area (never over the content), in
 * reach of the thumb. `background` is drawn behind everything (the heatmap's
 * glow) and never takes touches.
 */
export function Screen({
	children,
	edges = ["top"],
	onRefresh,
	refreshing = false,
	footer,
	background,
}: {
	children: ReactNode;
	edges?: Edge[];
	onRefresh?: () => void;
	refreshing?: boolean;
	footer?: ReactNode;
	background?: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	return (
		<SafeAreaView
			edges={edges}
			style={{ flex: 1, backgroundColor: colors.background }}
		>
			{background}
			<KeyboardAwareScrollView
				bottomOffset={24}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					onRefresh ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={[colors.violet[600]]}
							progressBackgroundColor={colors.surface}
							tintColor={colors.violet[400]}
						/>
					) : undefined
				}
			>
				<View className="gap-6 px-4 pt-4 pb-10">{children}</View>
			</KeyboardAwareScrollView>
			{footer ? (
				<View
					className="border-t border-border bg-background px-4 pt-3"
					style={{
						paddingBottom: (edges.includes("bottom") ? 0 : insets.bottom) + 12,
					}}
				>
					{footer}
				</View>
			) : null}
		</SafeAreaView>
	);
}
