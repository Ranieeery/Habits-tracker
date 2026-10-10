import { colors } from "@habits/design-tokens";
import { Stack } from "expo-router";
import { NotificationResponder } from "@/features/notifications/notification-responder.tsx";
import { SettingsGate } from "@/features/settings/settings-gate.tsx";

/** Authenticated area: needs the user's settings (time zone) to know "today". */
export default function AppLayout() {
	return (
		<SettingsGate>
			<NotificationResponder />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: colors.background },
					headerTintColor: colors.foreground,
					headerTitleStyle: { fontWeight: "700" },
					headerShadowVisible: false,
					contentStyle: { backgroundColor: colors.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="day/[date]" options={{ title: "" }} />
				<Stack.Screen
					name="habit/new"
					options={{ title: "Novo hábito", presentation: "modal" }}
				/>
				<Stack.Screen
					name="habit/[id]"
					options={{ title: "Editar hábito", presentation: "modal" }}
				/>
			</Stack>
		</SettingsGate>
	);
}
