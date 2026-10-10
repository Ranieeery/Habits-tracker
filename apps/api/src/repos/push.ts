import {
	type PushSubscription,
	PushSubscriptionView,
	type RegisterPushSubscriptionRequest,
} from "@habits/contracts";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
	fromPushSubscriptionRow,
	toPushSubscriptionRow,
} from "../db/records.ts";
import { pushSubscriptions, pushTickets } from "../db/schema.ts";

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

/**
 * The user's devices with their credentials, for sending only. Never return
 * these records to a client (use `toView`).
 */
export async function listPushTargets(
	db: Db,
	userId: string
): Promise<PushSubscription[]> {
	const rows = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.user_id, userId))
		.orderBy(asc(pushSubscriptions.created_at), asc(pushSubscriptions.id));
	return rows.map(fromPushSubscriptionRow);
}

/** Hard deletes devices the push service no longer knows (404/410, expo). */
export async function deletePushSubscriptions(
	db: Db,
	userId: string,
	subscriptionIds: string[]
): Promise<number> {
	if (subscriptionIds.length === 0) return 0;
	const deleted = await db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.user_id, userId),
				inArray(pushSubscriptions.id, subscriptionIds)
			)
		)
		.returning({ id: pushSubscriptions.id });
	return deleted.length;
}

/** Remembers Expo tickets so a later cron run can read their receipts. */
export async function insertPushTickets(
	db: Db,
	userId: string,
	tickets: { id: string; subscription_id: string }[],
	now: number
): Promise<void> {
	// 4 parameters per row; D1 allows 100 per statement.
	for (let i = 0; i < tickets.length; i += 25) {
		await db
			.insert(pushTickets)
			.values(
				tickets
					.slice(i, i + 25)
					.map((ticket) => ({ ...ticket, user_id: userId, created_at: now }))
			)
			.onConflictDoNothing();
	}
}
