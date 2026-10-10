// Web Push on this browser: support detection, permission and the browser's
// PushSubscription. Talking to the API stays in `queries.ts`; this module
// never sees the session.

/** What this browser can do about notifications right now. */
export type PushSupport =
	/** No service worker / Push API, or the build has no VAPID key. */
	| "unsupported"
	/** iPhone/iPad Safari: Web Push needs the installed app (Home Screen). */
	| "ios-needs-install"
	| "denied"
	/** Permission not asked yet. */
	| "prompt"
	| "granted";

export interface PushEnvironment {
	hasPushApi: boolean;
	/** `VITE_VAPID_PUBLIC_KEY` is set. */
	hasVapidKey: boolean;
	isIos: boolean;
	/** Running as the installed PWA. */
	isStandalone: boolean;
	permission: NotificationPermission | null;
}

export function pushSupport(env: PushEnvironment): PushSupport {
	if (env.isIos && !env.isStandalone) return "ios-needs-install";
	if (!env.hasPushApi || !env.hasVapidKey || env.permission === null) {
		return "unsupported";
	}
	if (env.permission === "denied") return "denied";
	if (env.permission === "granted") return "granted";
	return "prompt";
}

/** "Chrome no Android", "Safari no iPhone"… shown in the device list. */
export function deviceLabel(userAgent: string): string | null {
	const browser = /Edg\//.test(userAgent)
		? "Edge"
		: /Firefox\//.test(userAgent)
			? "Firefox"
			: /Chrome\//.test(userAgent)
				? "Chrome"
				: /Safari\//.test(userAgent)
					? "Safari"
					: null;
	const system = /Android/.test(userAgent)
		? "Android"
		: /iPhone/.test(userAgent)
			? "iPhone"
			: /iPad/.test(userAgent)
				? "iPad"
				: /Windows/.test(userAgent)
					? "Windows"
					: /Mac OS X/.test(userAgent)
						? "Mac"
						: /Linux/.test(userAgent)
							? "Linux"
							: null;
	if (!browser) return system;
	return system ? `${browser} no ${system}` : browser;
}

/** `applicationServerKey` bytes from the base64url VAPID public key. */
export function vapidKeyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
	const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** What the API needs from a browser subscription. */
export interface BrowserSubscription {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export type EnableResult =
	| { status: "subscribed"; subscription: BrowserSubscription }
	| { status: "denied" | "unsupported" };

export interface PushService {
	support(): PushSupport;
	/** Asks for permission (call from a click) and subscribes this browser. */
	enable(): Promise<EnableResult>;
	/** The current subscription, without asking anything. */
	current(): Promise<BrowserSubscription | null>;
	/** Unsubscribes this browser (no-op without a subscription). */
	disable(): Promise<void>;
	deviceLabel(): string | null;
	/** Id of this browser's subscription in the API (not a secret). */
	storedId(): string | null;
	storeId(id: string | null): void;
}

const STORAGE_KEY = "habits:push-subscription-id";

function toBrowserSubscription(
	subscription: PushSubscription
): BrowserSubscription | null {
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
	return {
		endpoint: json.endpoint,
		keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
	};
}

/** The real browser implementation. */
export function createBrowserPushService(
	vapidPublicKey: string | undefined
): PushService {
	const environment = (): PushEnvironment => {
		const nav = navigator as Navigator & { standalone?: boolean };
		const isIos =
			/iPhone|iPad|iPod/.test(nav.userAgent) ||
			(nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
		return {
			hasPushApi:
				"serviceWorker" in nav &&
				"PushManager" in window &&
				"Notification" in window,
			hasVapidKey: Boolean(vapidPublicKey),
			isIos,
			isStandalone:
				window.matchMedia("(display-mode: standalone)").matches ||
				nav.standalone === true,
			permission: "Notification" in window ? Notification.permission : null,
		};
	};

	/** The active registration, or null (the service worker is off in dev). */
	const registration = async () =>
		"serviceWorker" in navigator
			? ((await navigator.serviceWorker.getRegistration()) ?? null)
			: null;

	return {
		support: () => pushSupport(environment()),
		async enable() {
			if (pushSupport(environment()) === "unsupported" || !vapidPublicKey) {
				return { status: "unsupported" };
			}
			const permission = await Notification.requestPermission();
			if (permission !== "granted") return { status: "denied" };
			const reg = await registration();
			if (!reg) return { status: "unsupported" };
			const existing = await reg.pushManager.getSubscription();
			const subscription =
				existing ??
				(await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: vapidKeyBytes(vapidPublicKey),
				}));
			const browser = toBrowserSubscription(subscription);
			return browser
				? { status: "subscribed", subscription: browser }
				: { status: "unsupported" };
		},
		async current() {
			if (environment().permission !== "granted") return null;
			const subscription = await (
				await registration()
			)?.pushManager.getSubscription();
			return subscription ? toBrowserSubscription(subscription) : null;
		},
		async disable() {
			const subscription = await (
				await registration()
			)?.pushManager.getSubscription();
			await subscription?.unsubscribe();
		},
		deviceLabel: () => deviceLabel(navigator.userAgent),
		storedId: () => {
			try {
				return localStorage.getItem(STORAGE_KEY);
			} catch {
				return null;
			}
		},
		storeId: (id) => {
			try {
				if (id) localStorage.setItem(STORAGE_KEY, id);
				else localStorage.removeItem(STORAGE_KEY);
			} catch {
				// Storage unavailable: the device is still removed on sign-out
				// when the browser unsubscribes (the push service answers 410).
			}
		},
	};
}
