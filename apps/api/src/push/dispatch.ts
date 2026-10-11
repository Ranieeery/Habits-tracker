// Sends one notification to every device of a user. Each device is
// independent: a failure on one never stops the others. Devices the push
// service no longer knows are removed (Web Push 404/410, Expo
// DeviceNotRegistered); temporary failures keep the device. Never logs
// endpoints, keys or tokens.
import type {
	PushNotificationPayload,
	PushSubscription,
	PushTestResponse,
} from "@habits/contracts";
import type { Db } from "../db/client.ts";
import { deletePushSubscriptions, insertPushTickets } from "../repos/push.ts";
import {
	EXPO_SEND_BATCH,
	type ExpoMessage,
	isDeviceNotRegistered,
	sendExpoMessages,
} from "./expo.ts";
import { errorName, log } from "../lib/log.ts";
import { createWebPushSender, type VapidKeys } from "./webpush.ts";

/** Android channel created by the mobile app (`expo-notifications`). */
export const ANDROID_CHANNEL_ID = "reminders";

export interface PushMessage {
	kind: PushNotificationPayload["kind"];
	title: string;
	body: string;
	/** Replaces an earlier notification with the same tag on the device. */
	tag: string;
	/** Seconds the push service keeps it while the device is offline. */
	ttl: number;
}

/** Where a tap opens: the web app's and the mobile app's "today". */
const WEB_URL = "/today";
const APP_PATH = "/day/hoje";

export type SendResult = PushTestResponse;

/**
 * External fetches left in this invocation. The Workers Free plan allows 50
 * subrequests per invocation; callers check the cost before sending.
 */
export class FetchBudget {
	constructor(private remaining: number) {}

	canAfford(cost: number): boolean {
		return cost <= this.remaining;
	}

	spend(cost: number): void {
		if (!this.canAfford(cost)) throw new Error("Fetch budget exceeded");
		this.remaining -= cost;
	}
}

/** Fetches needed to reach these devices: one per web device, one per 100 Expo tokens. */
export function fetchCost(targets: readonly PushSubscription[]): number {
	const web = targets.filter((target) => target.kind === "webpush").length;
	const expo = targets.length - web;
	return web + Math.ceil(expo / EXPO_SEND_BATCH);
}

/**
 * The devices that fit in `maxFetches` (in their stored order): a user with
 * more devices than one run can reach still gets the first ones.
 */
export function withinFetchLimit(
	targets: readonly PushSubscription[],
	maxFetches: number
): PushSubscription[] {
	const budget = new FetchBudget(maxFetches);
	const selected: PushSubscription[] = [];
	let expoInBatch = 0;
	for (const target of targets) {
		// An Expo token costs a fetch only when it opens a new batch of 100.
		const cost =
			target.kind === "webpush"
				? 1
				: expoInBatch % EXPO_SEND_BATCH === 0
					? 1
					: 0;
		if (!budget.canAfford(cost)) continue;
		budget.spend(cost);
		if (target.kind === "expo") expoInBatch += 1;
		selected.push(target);
	}
	return selected;
}

export interface PushContext {
	db: Db;
	fetch: typeof fetch;
	now: number;
	/** Null when the VAPID secrets are missing: web devices are skipped. */
	vapid: VapidKeys | null;
	expoAccessToken: string | null;
}

/** One sender per invocation, so the VAPID JWT is signed once per service. */
export function createDispatcher(context: PushContext) {
	const buildWebPush = context.vapid
		? createWebPushSender(context.vapid, context.now)
		: null;

	async function sendWeb(
		target: Extract<PushSubscription, { kind: "webpush" }>,
		message: PushMessage
	): Promise<"sent" | "failed" | "gone"> {
		if (!buildWebPush) return "failed";
		const payload: PushNotificationPayload = {
			v: 1,
			kind: message.kind,
			title: message.title,
			body: message.body,
			url: WEB_URL,
			tag: message.tag,
		};
		try {
			const request = await buildWebPush(target, JSON.stringify(payload), {
				ttl: message.ttl,
				urgency: "normal",
				topic: message.kind,
			});
			const response = await context.fetch(request);
			// Only the status matters; release the body.
			await response.body?.cancel();
			if (response.ok) return "sent";
			if (response.status === 404 || response.status === 410) return "gone";
			log.warn("web_push_failed", { status: response.status });
			return "failed";
		} catch (error) {
			log.warn("web_push_failed", { error: errorName(error) });
			return "failed";
		}
	}

	async function sendExpo(
		targets: Extract<PushSubscription, { kind: "expo" }>[],
		message: PushMessage
	) {
		const sent: { id: string; subscription_id: string }[] = [];
		const gone: string[] = [];
		let failed = 0;
		for (let i = 0; i < targets.length; i += EXPO_SEND_BATCH) {
			const batch = targets.slice(i, i + EXPO_SEND_BATCH);
			const messages: ExpoMessage[] = batch.map((target) => ({
				to: target.token,
				title: message.title,
				body: message.body,
				data: { url: APP_PATH, kind: message.kind },
				channelId: ANDROID_CHANNEL_ID,
				priority: "high",
				sound: "default",
				ttl: message.ttl,
			}));
			try {
				const tickets = await sendExpoMessages(
					context.fetch,
					messages,
					context.expoAccessToken
				);
				tickets.forEach((ticket, index) => {
					const target = batch[index]!;
					if (ticket.status === "ok") {
						sent.push({ id: ticket.id, subscription_id: target.id });
					} else if (isDeviceNotRegistered(ticket)) {
						gone.push(target.id);
					} else {
						log.warn("expo_ticket_error", {
							code: ticket.details?.error ?? null,
						});
						failed += 1;
					}
				});
			} catch (error) {
				log.warn("expo_push_failed", { error: errorName(error) });
				failed += batch.length;
			}
		}
		return { sent, gone, failed };
	}

	/** Sends `message` to the given devices of `userId`. */
	return async function sendToUser(
		userId: string,
		targets: readonly PushSubscription[],
		message: PushMessage
	): Promise<SendResult> {
		const web = targets.filter((target) => target.kind === "webpush");
		const expo = targets.filter((target) => target.kind === "expo");

		const [webResults, expoResult] = await Promise.all([
			Promise.all(web.map((target) => sendWeb(target, message))),
			sendExpo(expo, message),
		]);

		const gone = [
			...web
				.filter((_, index) => webResults[index] === "gone")
				.map((t) => t.id),
			...expoResult.gone,
		];
		const removed = await deletePushSubscriptions(context.db, userId, gone);
		await insertPushTickets(context.db, userId, expoResult.sent, context.now);

		return {
			sent:
				webResults.filter((result) => result === "sent").length +
				expoResult.sent.length,
			failed:
				webResults.filter((result) => result === "failed").length +
				expoResult.failed,
			removed,
		};
	};
}

export type Dispatcher = ReturnType<typeof createDispatcher>;
