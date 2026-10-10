import {
	focusManager,
	MutationCache,
	onlineManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";
import { AppState } from "react-native";
import { DataError, isUnauthorized } from "./errors.ts";

/**
 * A 401 from any query or mutation means the session expired or was revoked:
 * `onUnauthorized` clears it and the router falls back to the login screen.
 */
export function createQueryClient(onUnauthorized: () => void): QueryClient {
	const handle = (error: unknown) => {
		if (isUnauthorized(error)) onUnauthorized();
	};
	return new QueryClient({
		queryCache: new QueryCache({ onError: handle }),
		mutationCache: new MutationCache({ onError: handle }),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				// Retry only what may succeed later (network, server errors).
				retry: (failureCount, error) =>
					error instanceof DataError &&
					(error.kind === "offline" || error.kind === "unknown") &&
					failureCount < 2,
			},
		},
	});
}

/**
 * Refetches stale queries when the app returns to the foreground, and pauses
 * them while offline (TanStack Query's React Native setup). Call once.
 */
export function connectQueryManagers(): () => void {
	const appState = AppState.addEventListener("change", (status) => {
		focusManager.setFocused(status === "active");
	});
	onlineManager.setEventListener((setOnline) => {
		const network = addNetworkStateListener((state) => {
			setOnline(state.isConnected !== false);
		});
		return () => network.remove();
	});
	return () => appState.remove();
}
