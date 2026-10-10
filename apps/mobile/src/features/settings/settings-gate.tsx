import { colors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isSettled, useSettings } from "@/data/hooks.ts";
import { SettingsContext } from "@/data/today.ts";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { QueryState } from "@/ui/states.tsx";

/**
 * Loads the user's settings before any authenticated screen: every "today"
 * depends on the saved time zone. The splash stays up while they load.
 */
export function SettingsGate({ children }: { children: ReactNode }) {
	const settings = useSettings();
	// Screens hide the splash once their own data is in; on failure or
	// offline, this gate shows its state instead.
	useHideSplashWhen(isSettled(settings) && settings.data === undefined);

	if (settings.data) {
		return <SettingsContext value={settings.data}>{children}</SettingsContext>;
	}
	if (settings.isPending && settings.fetchStatus !== "paused") return null;
	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
			<View className="flex-1 justify-center px-4">
				<QueryState query={settings}>{() => null}</QueryState>
			</View>
		</SafeAreaView>
	);
}
