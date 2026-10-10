import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useSyncPushRegistration } from "@/data/push-hooks.ts";
import { notificationPath } from "@/data/push-logic.ts";
import { useToast } from "@/ui/toast.tsx";

// With the app open, a reminder only lands in the notification list (no
// banner, no sound); the app shows a discreet toast instead.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: false,
		shouldShowList: true,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
});

/** Ids of responses already handled (the last one survives remounts). */
const handled = new Set<string>();

/**
 * Mounted in the authenticated layout: registers this device for push, opens
 * the right screen when a notification is tapped (also when the tap launched
 * the app), and shows foreground notifications as a toast.
 */
export function NotificationResponder() {
	const router = useRouter();
	const toast = useToast();
	useSyncPushRegistration();

	useEffect(() => {
		const open = (response: Notifications.NotificationResponse) => {
			const id = response.notification.request.identifier;
			if (handled.has(id)) return;
			handled.add(id);
			if (
				response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
			) {
				return;
			}
			const path = notificationPath(response.notification.request.content.data);
			// Typed routes cannot check a path that arrives at runtime.
			router.push(path as Parameters<typeof router.push>[0]);
		};

		void Notifications.getLastNotificationResponseAsync().then((response) => {
			if (response) open(response);
		});
		const responses =
			Notifications.addNotificationResponseReceivedListener(open);
		const received = Notifications.addNotificationReceivedListener(
			(notification) => {
				const { title, body } = notification.request.content;
				toast("info", title ?? "Habits", body ?? undefined);
			}
		);
		return () => {
			responses.remove();
			received.remove();
		};
	}, [router, toast]);

	return null;
}
