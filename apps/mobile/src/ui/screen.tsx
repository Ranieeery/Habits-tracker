import { nightColors } from "@habits/design-tokens";
import { useFocusEffect } from "expo-router";
import { type ReactNode, type Ref, useCallback, useRef } from "react";
import { RefreshControl, View } from "react-native";
import {
	KeyboardAwareScrollView,
	type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import {
	type Edge,
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useToastAnchor } from "./toast.tsx";

/** What `scrollRef` points at (it has `scrollTo`). */
export type ScreenScroll = KeyboardAwareScrollViewRef;

/**
 * Scrolling page with safe-area padding. Focused inputs scroll above the
 * keyboard (Android is edge-to-edge, so `adjustResize` alone is not enough).
 * Tab screens pass `edges={["top"]}`; screens under a native header pass none.
 * `footer` stays fixed below the scroll area (never over the content), in
 * reach of the thumb. `background` is drawn behind everything (the heatmap's
 * glow) and never takes touches. While the screen is focused, its footer's
 * top is reported to the toast, which then sits above it (2.6.0).
 */
export function Screen({
	children,
	edges = ["top"],
	inTabs = false,
	onRefresh,
	refreshing = false,
	footer,
	background,
	scrollRef,
}: {
	children: ReactNode;
	edges?: Edge[];
	/** A tab screen: the tab bar already clears the bottom safe area. */
	inTabs?: boolean;
	onRefresh?: () => void;
	refreshing?: boolean;
	footer?: ReactNode;
	background?: ReactNode;
	/** To scroll from the screen (e.g. back to the top after a filter). */
	scrollRef?: Ref<ScreenScroll>;
}) {
	const insets = useSafeAreaInsets();
	const reportFooter = useToastAnchor();
	const footerRef = useRef<View>(null);
	const focused = useRef(false);
	// Window coordinates (not onLayout's): the footer sits above the tab bar
	// on tabs and at the very bottom on stack screens, and the toast lives
	// at the root.
	const measureFooter = useCallback(() => {
		if (!focused.current) return;
		footerRef.current?.measureInWindow((_x, y) => reportFooter(y));
	}, [reportFooter]);
	useFocusEffect(
		useCallback(() => {
			focused.current = true;
			measureFooter();
			return () => {
				focused.current = false;
				reportFooter(null);
			};
		}, [measureFooter, reportFooter])
	);

	return (
		<SafeAreaView
			edges={edges}
			style={{ flex: 1, backgroundColor: nightColors.bg }}
		>
			{background}
			<KeyboardAwareScrollView
				ref={scrollRef}
				bottomOffset={24}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					onRefresh ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={[nightColors.accent.DEFAULT]}
							progressBackgroundColor={nightColors.surface.DEFAULT}
							tintColor={nightColors.accent.text}
						/>
					) : undefined
				}
			>
				<View className="gap-6 px-4 pt-4 pb-10">{children}</View>
			</KeyboardAwareScrollView>
			{footer ? (
				<View
					ref={footerRef}
					onLayout={measureFooter}
					className="border-t border-night-border bg-night-bg px-4 pt-3"
					style={{
						paddingBottom:
							(inTabs || edges.includes("bottom") ? 0 : insets.bottom) + 12,
					}}
				>
					{footer}
				</View>
			) : null}
		</SafeAreaView>
	);
}
