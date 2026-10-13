import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAlpha } from "@/lib/color.ts";
import type { IconName } from "@/ui/button.tsx";

/**
 * The active tab stands out by more than color (DESIGN.md "Navegação", like
 * the web's bottom bar): a pill behind its icon and a small bar on top.
 */
function tabIcon(name: IconName) {
	return function TabIcon({ focused }: { focused: boolean }) {
		return (
			<View style={styles.slot}>
				{focused ? <View style={styles.bar} /> : null}
				<View style={[styles.pill, focused && styles.pillActive]}>
					<MaterialCommunityIcons
						name={name}
						size={22}
						color={focused ? nightColors.accent.text : nightColors.muted}
					/>
				</View>
			</View>
		);
	};
}

/**
 * Bottom tabs, in the thumb's reach: Hoje (the daily action, opened first),
 * Histórico (the heatmap) and Hábitos, the same order as the web. Ajustes is
 * a rarely used stack screen behind the gear on each tab's header. Tabs are
 * peers: switching never slides.
 */
export default function TabsLayout() {
	// The custom icon (pill and top bar) is taller than the default bar, so
	// the height follows the bottom safe area itself: labels never reach the
	// Android buttons or gesture bar.
	const insets = useSafeAreaInsets();
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				animation: "none",
				sceneStyle: { backgroundColor: nightColors.bg },
				tabBarStyle: {
					backgroundColor: nightColors.bg,
					borderTopColor: nightColors.border.DEFAULT,
					height: 64 + insets.bottom,
					paddingBottom: insets.bottom + 6,
				},
				tabBarItemStyle: { paddingTop: 4 },
				tabBarActiveTintColor: nightColors.accent.text,
				tabBarInactiveTintColor: nightColors.muted,
				tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: "Hoje", tabBarIcon: tabIcon("calendar-check") }}
			/>
			<Tabs.Screen
				name="history"
				options={{
					title: "Histórico",
					tabBarIcon: tabIcon("view-grid-outline"),
				}}
			/>
			<Tabs.Screen
				name="habits"
				options={{
					title: "Hábitos",
					tabBarIcon: tabIcon("format-list-checks"),
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	slot: { alignItems: "center" },
	bar: {
		position: "absolute",
		top: -8,
		width: 24,
		height: 3,
		borderRadius: 2,
		backgroundColor: nightColors.accent.text,
	},
	pill: {
		width: 56,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	pillActive: { backgroundColor: withAlpha(nightColors.accent.DEFAULT, 0.2) },
});
