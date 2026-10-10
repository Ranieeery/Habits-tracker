import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import type { IconName } from "@/ui/button.tsx";

function tabIcon(name: IconName) {
	return function TabIcon({
		color,
		size,
	}: {
		color: ColorValue;
		size: number;
	}) {
		return <MaterialCommunityIcons name={name} color={color} size={size} />;
	};
}

/** Bottom tabs: reachable with the thumb. */
export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				sceneStyle: { backgroundColor: colors.background },
				tabBarStyle: {
					backgroundColor: colors.background,
					borderTopColor: colors.border,
				},
				tabBarActiveTintColor: colors.violet[400],
				tabBarInactiveTintColor: colors.muted,
				tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{ title: "Início", tabBarIcon: tabIcon("calendar-month") }}
			/>
			<Tabs.Screen
				name="habits"
				options={{
					title: "Hábitos",
					tabBarIcon: tabIcon("format-list-checks"),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{ title: "Ajustes", tabBarIcon: tabIcon("cog-outline") }}
			/>
		</Tabs>
	);
}
