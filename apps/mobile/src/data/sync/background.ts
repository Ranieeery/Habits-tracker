// Background sync with expo-background-task (WorkManager on Android: at most
// every 15 minutes, only with network and enough battery; the OS decides the
// exact time). The task is defined at module scope, as expo-task-manager
// requires: the root layout imports this file, so the definition also exists
// when the OS starts the app headless just to run it.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { getServices } from "../services.ts";

export const SYNC_TASK = "habits-sync";
/** Minutes; WorkManager's minimum. */
const MINIMUM_INTERVAL = 15;

TaskManager.defineTask(SYNC_TASK, async () => {
	try {
		const services = getServices();
		// Only for a signed-in user whose data is on this device.
		const [cookie, userId] = await Promise.all([
			services.auth.getCookie(),
			services.local.getMeta("user_id"),
		]);
		if (!cookie || !userId) return BackgroundTask.BackgroundTaskResult.Success;
		await services.sync.refresh();
		services.sync.start();
		const outcome = await services.sync.sync("background");
		return outcome === "failed"
			? BackgroundTask.BackgroundTaskResult.Failed
			: BackgroundTask.BackgroundTaskResult.Success;
	} catch {
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

/** After the first full sync. Never throws (background sync is a bonus). */
export async function registerBackgroundSync(): Promise<void> {
	try {
		const status = await BackgroundTask.getStatusAsync();
		if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
		if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
		await BackgroundTask.registerTaskAsync(SYNC_TASK, {
			minimumInterval: MINIMUM_INTERVAL,
		});
	} catch {
		// Restricted by the OS or not supported: foreground sync still works.
	}
}

/** Debug builds only: asks the OS to run the task now (manual testing). */
export function runBackgroundSyncForTesting(): Promise<boolean> {
	return BackgroundTask.triggerTaskWorkerForTestingAsync();
}

/** On sign-out. Never throws. */
export async function unregisterBackgroundSync(): Promise<void> {
	try {
		if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) {
			await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
		}
	} catch {
		// Nothing registered.
	}
}
