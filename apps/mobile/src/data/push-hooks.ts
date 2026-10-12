// Reminders and this device's push registration, for the screens. Push
// failures never block sign-in or sign-out.
import type {
	ReminderTime,
	UpdateUserSettingsRequest,
	UserSettings,
} from "@habits/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPushTokenListener } from "expo-notifications";
import { useEffect } from "react";
import { queryKeys } from "./hooks.ts";
import type { PushPermission } from "./push-logic.ts";
import { registerThisDevice } from "./push-registration.ts";
import { useServices } from "./services.ts";

export const pushKeys = {
	permission: ["push-permission"] as const,
};

export const DEFAULT_REMINDER_TIME = "20:00";

/** Re-read when the app returns to the foreground (e.g. from system settings). */
export function usePushPermission() {
	const { pushDevice } = useServices();
	return useQuery({
		queryKey: pushKeys.permission,
		queryFn: () => pushDevice.permission(),
		staleTime: 0,
		networkMode: "always",
	});
}

/**
 * Saves the account's reminder time; null turns reminders off. Optimistic:
 * the screen shows the new value at once and rolls back if the save fails.
 */
export function useSaveReminderTime() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["reminder-time"],
		mutationFn: (reminder_time: ReminderTime | null) =>
			repository.updateSettings({ reminder_time }),
		onMutate: async (reminder_time) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.settings });
			const previous = queryClient.getQueryData<UserSettings>(
				queryKeys.settings
			);
			if (previous) {
				queryClient.setQueryData<UserSettings>(queryKeys.settings, {
					...previous,
					reminder_time,
				});
			}
			return { previous };
		},
		onError: (_error, _time, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.settings, context.previous);
			}
		},
		onSuccess: (settings) =>
			queryClient.setQueryData(queryKeys.settings, settings),
	});
}

type NotificationFlags = Pick<
	UpdateUserSettingsRequest,
	"morning_digest_enabled" | "show_titles_in_notifications"
>;

/**
 * Saves the morning digest and title preferences. Optimistic: the switch
 * moves at once and rolls back if the save fails (settings need the network).
 */
export function useSaveNotificationFlags() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["notification-flags"],
		mutationFn: (changes: NotificationFlags) =>
			repository.updateSettings(changes),
		onMutate: async (changes) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.settings });
			const previous = queryClient.getQueryData<UserSettings>(
				queryKeys.settings
			);
			if (previous) {
				queryClient.setQueryData<UserSettings>(queryKeys.settings, {
					...previous,
					...changes,
				});
			}
			return { previous };
		},
		onError: (_error, _changes, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.settings, context.previous);
			}
		},
		onSuccess: (settings) =>
			queryClient.setQueryData(queryKeys.settings, settings),
	});
}

export type EnableOutcome = "enabled" | Exclude<PushPermission, "granted">;

/**
 * Turns the morning digest on and makes sure this device can receive it
 * (permission asked now, from the tap). The setting is saved even without
 * permission: other devices still get the digest.
 */
export function useEnableDigest() {
	const services = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (): Promise<EnableOutcome> => {
			const permission = await services.pushDevice.requestPermission();
			void queryClient.invalidateQueries({ queryKey: pushKeys.permission });
			const registered =
				permission === "granted" && (await registerThisDevice(services));
			const settings = await services.repository.updateSettings({
				morning_digest_enabled: true,
			});
			queryClient.setQueryData(queryKeys.settings, settings);
			if (permission !== "granted") return permission;
			return registered ? "enabled" : "unavailable";
		},
	});
}

/**
 * Turns reminders on: asks for permission now (never on launch), registers
 * this device, then saves the time. Without permission nothing is saved.
 */
export function useEnableReminders() {
	const services = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (time: ReminderTime): Promise<EnableOutcome> => {
			const permission = await services.pushDevice.requestPermission();
			void queryClient.invalidateQueries({ queryKey: pushKeys.permission });
			if (permission !== "granted") return permission;
			if (!(await registerThisDevice(services))) return "unavailable";
			const settings = await services.repository.updateSettings({
				reminder_time: time,
			});
			queryClient.setQueryData(queryKeys.settings, settings);
			return "enabled";
		},
	});
}

export function useSendTestPush() {
	const { notifications } = useServices();
	return useMutation({ mutationFn: () => notifications.sendTest() });
}

/**
 * With permission already granted, registers this device after sign-in and
 * whenever Expo rotates its token. Never asks for permission.
 */
export function useSyncPushRegistration() {
	const services = useServices();
	const { pushDevice, notifications } = services;
	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				await pushDevice.ensureChannel();
				if (active) await registerThisDevice({ pushDevice, notifications });
			} catch {
				// No network or no Firebase setup yet: retried on next launch.
			}
		})();
		// Asking for the Expo token (as registering does) also emits this event
		// with the same device token: re-register only when it really changed,
		// or every registration would trigger the next one.
		let lastDeviceToken: string | null = null;
		const subscription = addPushTokenListener(({ data }) => {
			const token = String(data);
			if (token === lastDeviceToken) return;
			lastDeviceToken = token;
			// Sends nothing if the Expo token is the one already registered.
			void registerThisDevice({ pushDevice, notifications }).catch(
				() => undefined
			);
		});
		return () => {
			active = false;
			subscription.remove();
		};
	}, [pushDevice, notifications]);
}
