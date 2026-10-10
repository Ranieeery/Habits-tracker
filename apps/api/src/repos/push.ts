import {
	type PushSubscription,
	PushSubscriptionView,
	type RegisterPushSubscriptionRequest,
} from "@habits/contracts";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
	fromPushSubscriptionRow,
	toPushSubscriptionRow,
} from "../db/records.ts";
import { pushSubscriptions } from "../db/schema.ts";

/** Drops the endpoint, keys and token: they never leave the server. */
export function toView(subscription: PushSubscription): PushSubscriptionView {
	return PushSubscriptionView.parse(subscription);
}

function isUniqueViolation(error: unknown): boolean {
	const message = error instanceof Error ? String(error.cause ?? error) : "";
	return /UNIQUE constraint failed/i.test(message);
}

/**
 * Registers or refreshes a device. The endpoint (web push) or token (expo) is
 * unique across all users and is itself the proof of owning the device, so
 * registering it moves it to the current user: the only statement here not
 * limited to the user's own rows is the delete of that same device for other
 * users. Returns null when the requested id is taken by another record.
 */
export async function registerPushSubscription(
	db: Db,
	userId: string,
	request: RegisterPushSubscriptionRequest,
	id: string,
	now: number
): Promise<PushSubscription | null> {
	const common = {
		id,
		device_label: request.device_label ?? null,
		last_seen_at: now,
		created_at: now,
		updated_at: now,
	};
	const record: PushSubscription =
		request.kind === "webpush"
			? {
					...common,
					kind: "webpush",
					endpoint: request.endpoint,
					p256dh: request.keys.p256dh,
					auth: request.keys.auth,
				}
			: { ...common, kind: "expo", token: request.token };
	const row = toPushSubscriptionRow(userId, record);
	const deviceColumn =
		record.kind === "webpush"
			? pushSubscriptions.endpoint
			: pushSubscriptions.token;
	const deviceValue =
		record.kind === "webpush" ? record.endpoint : record.token;
	const sameDevice = eq(deviceColumn, deviceValue);

	try {
		await db.batch([
			db
				.delete(pushSubscriptions)
				.where(and(sameDevice, ne(pushSubscriptions.user_id, userId))),
			db
				.insert(pushSubscriptions)
				.values(row)
				.onConflictDoUpdate({
					target: deviceColumn,
					set: {
						p256dh: row.p256dh,
						auth: row.auth,
						device_label:
							request.device_label === undefined
								? sql`${pushSubscriptions.device_label}`
								: row.device_label,
						last_seen_at: now,
						updated_at: now,
					},
					setWhere: eq(pushSubscriptions.user_id, userId),
				}),
		]);
	} catch (error) {
		if (isUniqueViolation(error)) return null;
		throw error;
	}

	const stored = await db.query.pushSubscriptions.findFirst({
		where: and(eq(pushSubscriptions.user_id, userId), sameDevice),
	});
	return stored ? fromPushSubscriptionRow(stored) : null;
}

/** Hard delete; false if the subscription is not the user's. */
export async function deletePushSubscription(
	db: Db,
	userId: string,
	subscriptionId: string
): Promise<boolean> {
	const deleted = await db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.user_id, userId),
				eq(pushSubscriptions.id, subscriptionId)
			)
		)
		.returning({ id: pushSubscriptions.id });
	return deleted.length > 0;
}
