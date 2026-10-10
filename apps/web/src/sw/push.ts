// Push notifications: shows each push message and, on click, focuses an open
// window of the app (navigating it to the message's path) or opens a new one.
// No caching here: notifications carry no data beyond their text.
import { notificationFor, safeAppPath } from "../lib/push-payload.ts";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
	let data: unknown = null;
	try {
		data = event.data?.json();
	} catch {
		// Not JSON: show the fallback.
	}
	const { title, body, tag, url } = notificationFor(data);
	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			tag,
			lang: "pt-BR",
			icon: "/android-chrome-192x192.png",
			badge: "/android-chrome-192x192.png",
			data: { url },
		})
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const data: unknown = event.notification.data;
	const path = safeAppPath(
		typeof data === "object" && data !== null && "url" in data
			? data.url
			: undefined
	);
	const target = new URL(path, self.location.origin).href;

	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			const open = windows.find(
				(client) => new URL(client.url).origin === self.location.origin
			);
			if (open) {
				const focused = await open.focus();
				// `navigate` only works on windows this worker controls.
				await focused.navigate(target).catch(() => undefined);
				return;
			}
			await self.clients.openWindow(target);
		})()
	);
});
