// Pure push helpers (no native imports), tested with Vitest.

/** What the settings screen shows about this device. */
export type PushPermission =
	| "granted"
	/** Never asked, or can still be asked. */
	| "undetermined"
	/** Refused and Android will not ask again: only system settings help. */
	| "denied"
	/** No push here (emulator without Play services, missing Firebase setup). */
	| "unavailable";

export function permissionFrom(status: {
	granted: boolean;
	canAskAgain: boolean;
	status: string;
}): PushPermission {
	if (status.granted || status.status === "granted") return "granted";
	if (status.status === "denied" && !status.canAskAgain) return "denied";
	return "undetermined";
}

/** The app route a notification opens: its own path, or today. */
export function notificationPath(data: unknown): string {
	const url =
		typeof data === "object" && data !== null && "url" in data
			? (data as { url: unknown }).url
			: undefined;
	return typeof url === "string" && /^\/(?![/\\])/.test(url)
		? url
		: "/day/hoje";
}
