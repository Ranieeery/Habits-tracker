// Reminders and this device's push registration, for the screens. Push
// failures never block sign-in or sign-out.
import type { ReminderTime } from "@habits/contracts";
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

/** Saves the account's reminder time; null turns reminders off. */
export function useSaveReminderTime() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (reminder_time: ReminderTime | null) =>
			repository.updateSettings({ reminder_time }),
		onSuccess: (settings) =>
			queryClient.setQueryData(queryKeys.settings, settings),
	});
}

export type EnableOutcome = "enabled" | Exclude<PushPermission, "granted">;

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
		const subscription = addPushTokenListener(() => {
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
