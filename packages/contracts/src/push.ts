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
