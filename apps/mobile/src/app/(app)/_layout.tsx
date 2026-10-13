import { nightColors } from "@habits/design-tokens";
import { Stack } from "expo-router";
import { NotificationResponder } from "@/features/notifications/notification-responder.tsx";
import { SettingsGate } from "@/features/settings/settings-gate.tsx";
import { InitialSyncGate } from "@/features/sync/initial-sync-gate.tsx";

/**
 * Authenticated area: syncs the device database (the first full download
 * blocks it), then needs the user's settings (time zone) to know "today".
 */
export default function AppLayout() {
	return (
		<InitialSyncGate>
			<SettingsGate>
				<NotificationResponder />
				<Stack
					screenOptions={{
						headerStyle: { backgroundColor: nightColors.bg },
						headerTintColor: nightColors.foreground,
						headerTitleStyle: { fontWeight: "700" },
						headerShadowVisible: false,
						contentStyle: { backgroundColor: nightColors.bg },
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
					<Stack.Screen name="settings" options={{ title: "Ajustes" }} />
					<Stack.Screen
						name="sync"
						options={{ title: "Sincronização", presentation: "modal" }}
					/>
				</Stack>
			</SettingsGate>
		</InitialSyncGate>
	);
}
