// Sync state for the UI: status indicator, initial sync gate, failures list.
// Re-exported by `data/hooks.ts`, the only data module screens import.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useServices } from "../services.ts";
import { runBackgroundSyncForTesting } from "./background.ts";
import type { SyncStatus } from "./engine.ts";
import { describeFailures, habitNames } from "./failures.ts";

export const syncQueryKeys = {
	failures: ["sync", "failures"] as const,
};

export function useSyncStatus(): SyncStatus {
	const { sync } = useServices();
	return useSyncExternalStore(sync.subscribe, sync.getStatus);
}

/** The changes the server refused for good, described for the user. */
export function useSyncFailures() {
	const { local, repository } = useServices();
	const { failed } = useSyncStatus();
	const queryClient = useQueryClient();
	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: syncQueryKeys.failures });
	}, [failed, queryClient]);
	return useQuery({
		queryKey: syncQueryKeys.failures,
		queryFn: async () => {
			const [entries, habits] = await Promise.all([
				local.readOutbox(),
				repository.listHabits(),
			]);
			return describeFailures(entries, habitNames(habits, entries));
		},
	});
}

/** Sends the given failed changes again (and syncs). */
export function useRetryFailures() {
	const { sync } = useServices();
	return useMutation({
		mutationFn: (mutationIds: string[]) => sync.retry(mutationIds),
	});
}

/** Drops the given failed changes for good. */
export function useDiscardFailures() {
	const { sync } = useServices();
	return useMutation({
		mutationFn: (mutationIds: string[]) => sync.discard(mutationIds),
	});
}

/** Syncs, then answers how many changes are still not on the server. */
export function useSyncAndCountUnsynced() {
	const { sync } = useServices();
	return useMutation({
		mutationFn: async () => {
			await sync.sync("manual");
			const { pending, failed } = sync.getStatus();
			return pending + failed;
		},
	});
}

/** Debug builds: runs the background sync task now (manual checks). */
export function useRunBackgroundSync() {
	return useMutation({ mutationFn: runBackgroundSyncForTesting });
}

/** "Sincronizar agora". */
export function useSyncNow() {
	const { sync } = useServices();
	return useMutation({ mutationFn: () => sync.sync("manual") });
}
