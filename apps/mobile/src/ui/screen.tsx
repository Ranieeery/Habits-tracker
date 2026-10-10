import { colors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { RefreshControl, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";

/**
 * Scrolling page with safe-area padding. Focused inputs scroll above the
 * keyboard (Android is edge-to-edge, so `adjustResize` alone is not enough).
 * Tab screens pass `edges={["top"]}`; screens under a native header pass none.
 */
export function Screen({
	children,
	edges = ["top"],
	onRefresh,
	refreshing = false,
}: {
	children: ReactNode;
	edges?: Edge[];
	onRefresh?: () => void;
	refreshing?: boolean;
}) {
	return (
		<SafeAreaView
			edges={edges}
			style={{ flex: 1, backgroundColor: colors.background }}
		>
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
		</SafeAreaView>
	);
}
