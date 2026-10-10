// Shared by the service worker and its tests: what a push message shows and
// where a click goes. No DOM or service worker types here.
import { PushNotificationPayload } from "@habits/contracts";

export interface NotificationContent {
	title: string;
	body: string;
	tag: string;
	/** Same-app path opened on click. */
	url: string;
}

/** Shown when a message cannot be read (browsers require showing something). */
export const FALLBACK_NOTIFICATION: NotificationContent = {
	title: "Habits",
	body: "Abra o app para ver seus hábitos de hoje.",
	tag: "habits",
	url: "/today",
};

/** The notification for a push message's JSON (or the fallback). */
export function notificationFor(data: unknown): NotificationContent {
	const parsed = PushNotificationPayload.safeParse(data);
	if (!parsed.success) return FALLBACK_NOTIFICATION;
	const { title, body, tag, url } = parsed.data;
	return { title, body, tag, url };
}

/** Only paths of this app: anything else opens "today". */
export function safeAppPath(url: unknown): string {
	return typeof url === "string" && /^\/(?![/\\])/.test(url) ? url : "/today";
}
