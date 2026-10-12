import "../global.css";
// Defines the background sync task at module scope (also needed when the OS
// starts the app headless only to run it).
import "@/data/sync/background.ts";

import { colors } from "@habits/design-tokens";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
	invalidateHabitData,
	queryKeys,
	resetToSignedOut,
	useSession,
} from "@/data/hooks.ts";
import {
	connectQueryManagers,
	createQueryClient,
} from "@/data/query-client.ts";
import { getServices, ServicesContext } from "@/data/services.ts";
import { syncQueryKeys } from "@/data/sync/hooks.ts";
import { useDisplayFontsReady } from "@/ui/fonts.ts";
import { keepSplashVisible } from "@/ui/splash.ts";
import { ToastProvider } from "@/ui/toast.tsx";

keepSplashVisible();

const services = getServices();

let signingOut = false;
/**
 * The session expired or was revoked. The device database is kept: its
 * pending changes are sent after the same user signs in again (another user
 * signing in wipes it first). Only "Sair" in Ajustes wipes it.
 */
function onUnauthorized() {
	// Many queries can fail with 401 at once: sign out a single time.
	if (signingOut) return;
	signingOut = true;
	void services.sync
		.stop()
		.then(() => services.auth.signOut())
		.finally(() => {
			resetToSignedOut(queryClient);
			signingOut = false;
		});
}

const queryClient = createQueryClient(onUnauthorized);

services.setSyncHandlers({
	onUnauthorized,
	onDataChanged: () => {
		void invalidateHabitData(queryClient);
		void queryClient.invalidateQueries({ queryKey: syncQueryKeys.failures });
	},
	onSettingsChanged: (settings) => {
		queryClient.setQueryData(queryKeys.settings, settings);
		void invalidateHabitData(queryClient);
	},
});

export default function RootLayout() {
	useEffect(() => connectQueryManagers(), []);

	return (
		<SafeAreaProvider>
			<KeyboardProvider>
				<ServicesContext value={services}>
					<QueryClientProvider client={queryClient}>
						<ToastProvider>
							<RootNavigator />
						</ToastProvider>
					</QueryClientProvider>
				</ServicesContext>
			</KeyboardProvider>
			<StatusBar style="light" />
		</SafeAreaProvider>
	);
}

function RootNavigator() {
	const session = useSession();
	const fontsReady = useDisplayFontsReady();
	// The native splash stays up while the stored session is restored and the
	// display font loads (never a frame in the fallback face).
	if (session.isPending || !fontsReady) return null;
	const signedIn = session.data?.status === "signed_in";

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
				animation: "fade",
			}}
		>
			<Stack.Protected guard={signedIn}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="login" />
			</Stack.Protected>
		</Stack>
	);
}
