// When the app syncs while open: on launch, when it comes back to the
// foreground, when the network returns, every few minutes while active, and
// shortly after each local write (the repository calls `notifyLocalWrite`).
// The background task covers the time the app is closed.
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useServices } from "../services.ts";
import { registerBackgroundSync } from "./background.ts";
import { useSyncStatus } from "./hooks.ts";

const FOREGROUND_INTERVAL_MS = 5 * 60_000;

function isOnline(state: {
	isConnected?: boolean;
	isInternetReachable?: boolean;
}): boolean {
	return state.isConnected !== false && state.isInternetReachable !== false;
}

export function useSyncTriggers() {
	const { sync } = useServices();
	const { initialSyncDone } = useSyncStatus();

	useEffect(() => {
		void sync.sync("launch");
		const appState = AppState.addEventListener("change", (status) => {
			if (status === "active") void sync.sync("foreground");
		});
		const network = addNetworkStateListener((state) =>
			sync.setOnline(isOnline(state))
		);
		void getNetworkStateAsync()
			.then((state) => sync.setOnline(isOnline(state)))
			.catch(() => undefined);
		const timer = setInterval(() => {
			if (AppState.currentState === "active") void sync.sync("interval");
		}, FOREGROUND_INTERVAL_MS);
		return () => {
			appState.remove();
			network.remove();
			clearInterval(timer);
		};
	}, [sync]);

	useEffect(() => {
		if (initialSyncDone) void registerBackgroundSync();
	}, [initialSyncDone]);
}
