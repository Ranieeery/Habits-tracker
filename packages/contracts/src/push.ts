import { z } from "zod";
import { TimestampMs, Uuid } from "./primitives.ts";

const PushSubscriptionBase = {
	id: Uuid,
	/** Human-readable device name shown in settings, e.g. "Pixel 9". */
	device_label: z.string().trim().min(1).max(120).nullable(),
	/** Last time the device registered or refreshed the subscription. */
	last_seen_at: TimestampMs,
	created_at: TimestampMs,
	updated_at: TimestampMs,
};

/** Standard Web Push subscription (VAPID), from `PushManager.subscribe()`. */
export const WebPushSubscription = z.object({
	...PushSubscriptionBase,
	kind: z.literal("webpush"),
	endpoint: z.url(),
	/** Client public key (`keys.p256dh`), base64url. */
	p256dh: z.string().min(1),
	/** Client auth secret (`keys.auth`), base64url. */
	auth: z.string().min(1),
});
export type WebPushSubscription = z.infer<typeof WebPushSubscription>;

/** Expo push token from `expo-notifications`. */
export const ExpoPushSubscription = z.object({
	...PushSubscriptionBase,
	kind: z.literal("expo"),
	token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, {
		message: "Expected an Expo push token",
	}),
});
export type ExpoPushSubscription = z.infer<typeof ExpoPushSubscription>;

/** A device that receives push notifications. New kinds are new members. */
export const PushSubscription = z.discriminatedUnion("kind", [
	WebPushSubscription,
	ExpoPushSubscription,
]);
export type PushSubscription = z.infer<typeof PushSubscription>;
export type PushSubscriptionKind = PushSubscription["kind"];

const RegisterPushSubscriptionBase = {
	/** Client-generated id; the server generates one when omitted. */
	id: Uuid.optional(),
	device_label: PushSubscriptionBase.device_label.optional(),
};

/**
 * Registers (or refreshes) a device. Web Push sends the browser's
 * `PushSubscription.toJSON()` shape; Expo sends the push token.
 */
export const RegisterPushSubscriptionRequest = z.discriminatedUnion("kind", [
	z.object({
		...RegisterPushSubscriptionBase,
		kind: z.literal("webpush"),
		endpoint: WebPushSubscription.shape.endpoint,
		keys: z.object({
			p256dh: WebPushSubscription.shape.p256dh,
			auth: WebPushSubscription.shape.auth,
		}),
	}),
	z.object({
		...RegisterPushSubscriptionBase,
		kind: z.literal("expo"),
		token: ExpoPushSubscription.shape.token,
	}),
]);
export type RegisterPushSubscriptionRequest = z.infer<
	typeof RegisterPushSubscriptionRequest
>;

/**
 * What the API returns about a subscription. Never includes the endpoint, the
 * keys or the token: they are credentials to push to the device.
 */
export const PushSubscriptionView = z.object({
	...PushSubscriptionBase,
	kind: z.enum(["webpush", "expo"]),
});
export type PushSubscriptionView = z.infer<typeof PushSubscriptionView>;

export const PushSubscriptionResponse = z.object({
	subscription: PushSubscriptionView,
});
export type PushSubscriptionResponse = z.infer<typeof PushSubscriptionResponse>;

export const PushSubscriptionParams = z.object({ subscription_id: Uuid });
export type PushSubscriptionParams = z.infer<typeof PushSubscriptionParams>;

/** Result of `POST /v1/push/test`: counts only, never device credentials. */
export const PushTestResponse = z.object({
	/** Devices the push service accepted the message for. */
	sent: z.int().nonnegative(),
	/** Devices that failed temporarily (kept for the next attempt). */
	failed: z.int().nonnegative(),
	/** Devices removed because the push service no longer knows them. */
	removed: z.int().nonnegative(),
});
export type PushTestResponse = z.infer<typeof PushTestResponse>;

/**
 * What a Web Push message carries to the service worker (encrypted). `v` lets
 * the service worker accept newer payloads it does not understand gracefully.
 * It can show on the lock screen: habit names appear only in the morning
 * digest, and only while the user's `show_titles_in_notifications` is on.
 */
export const PushNotificationPayload = z.object({
	v: z.literal(1),
	kind: z.enum(["reminder", "digest", "test"]),
	title: z.string().min(1).max(120),
	body: z.string().min(1).max(240),
	/** Same-app path to open on click, e.g. `/today` (never `//host`). */
	url: z.string().regex(/^\/(?![/\\])/, { message: "Expected an app path" }),
	/** Replaces an earlier notification with the same tag. */
	tag: z.string().min(1).max(64),
});
export type PushNotificationPayload = z.infer<typeof PushNotificationPayload>;
