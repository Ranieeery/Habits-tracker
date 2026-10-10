import "../global.css";

import { colors } from "@habits/design-tokens";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { resetToSignedOut, useSession } from "@/data/hooks.ts";
import {
	connectQueryManagers,
	createQueryClient,
} from "@/data/query-client.ts";
import { createServices, ServicesContext } from "@/data/services.ts";
import { keepSplashVisible } from "@/ui/splash.ts";
import { ToastProvider } from "@/ui/toast.tsx";

keepSplashVisible();

const services = createServices();

let signingOut = false;
const queryClient = createQueryClient(() => {
	// Many queries can fail with 401 at once: sign out a single time.
	if (signingOut) return;
	signingOut = true;
	void services.auth.signOut().finally(() => {
		resetToSignedOut(queryClient);
		signingOut = false;
	});
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
	// The native splash stays up while the stored session is restored.
	if (session.isPending) return null;
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
