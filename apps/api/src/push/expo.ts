// Minimal client for the Expo Push Service (plain fetch; the official SDK
// needs Node). https://docs.expo.dev/push-notifications/sending-notifications/
import { z } from "zod";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Messages per send request and ids per receipts request (Expo limits). */
export const EXPO_SEND_BATCH = 100;
export const EXPO_RECEIPTS_BATCH = 1000;

export interface ExpoMessage {
	to: string;
	title: string;
	body: string;
	data: Record<string, string>;
	channelId: string;
	priority: "default" | "normal" | "high";
	sound: "default";
	/** Seconds Expo/FCM keep an undelivered message. */
	ttl: number;
}

const Details = z.looseObject({ error: z.string().optional() }).optional();

const Ticket = z.discriminatedUnion("status", [
	z.object({ status: z.literal("ok"), id: z.string().min(1) }),
	z.object({
		status: z.literal("error"),
		message: z.string().optional(),
		details: Details,
	}),
]);
export type ExpoTicket = z.infer<typeof Ticket>;

const SendResponse = z.object({ data: z.array(Ticket) });

const Receipt = z.discriminatedUnion("status", [
	z.object({ status: z.literal("ok") }),
	z.object({
		status: z.literal("error"),
		message: z.string().optional(),
		details: Details,
	}),
]);
export type ExpoReceipt = z.infer<typeof Receipt>;

const ReceiptsResponse = z.object({ data: z.record(z.string(), Receipt) });

/** The service answered with a non-2xx status or an unexpected body. */
export class ExpoPushError extends Error {
	constructor(readonly status: number) {
		super(`Expo push service responded ${status}`);
		this.name = "ExpoPushError";
	}
}

function headers(accessToken: string | null): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Accept: "application/json",
		...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
	};
}

/**
 * Sends up to `EXPO_SEND_BATCH` messages; tickets come back in the same order.
 * Throws `ExpoPushError` (or a network error) when the whole request failed.
 */
export async function sendExpoMessages(
	fetcher: typeof fetch,
	messages: ExpoMessage[],
	accessToken: string | null
): Promise<ExpoTicket[]> {
	if (messages.length > EXPO_SEND_BATCH) {
		throw new Error(`At most ${EXPO_SEND_BATCH} messages per request`);
	}
	const response = await fetcher(SEND_URL, {
		method: "POST",
		headers: headers(accessToken),
		body: JSON.stringify(messages),
	});
	if (!response.ok) throw new ExpoPushError(response.status);
	const parsed = SendResponse.safeParse(
		await response.json().catch(() => null)
	);
	if (!parsed.success || parsed.data.data.length !== messages.length) {
		throw new ExpoPushError(response.status);
	}
	return parsed.data.data;
}

/** Receipts by id; ids without a receipt (not ready, or expired) are absent. */
export async function getExpoReceipts(
	fetcher: typeof fetch,
	ids: string[],
	accessToken: string | null
): Promise<Record<string, ExpoReceipt>> {
	if (ids.length > EXPO_RECEIPTS_BATCH) {
		throw new Error(`At most ${EXPO_RECEIPTS_BATCH} ids per request`);
	}
	const response = await fetcher(RECEIPTS_URL, {
		method: "POST",
		headers: headers(accessToken),
		body: JSON.stringify({ ids }),
	});
	if (!response.ok) throw new ExpoPushError(response.status);
	const parsed = ReceiptsResponse.safeParse(
		await response.json().catch(() => null)
	);
	if (!parsed.success) throw new ExpoPushError(response.status);
	return parsed.data.data;
}

/** The device uninstalled the app or the token is no longer valid. */
export function isDeviceNotRegistered(
	result: ExpoTicket | ExpoReceipt
): boolean {
	return (
		result.status === "error" && result.details?.error === "DeviceNotRegistered"
	);
}
