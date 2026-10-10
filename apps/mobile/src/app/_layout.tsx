import "../global.css";

import { colors } from "@habits/design-tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
	return (
		<>
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
				}}
			/>
			<StatusBar style="light" />
		</>
	);
}
