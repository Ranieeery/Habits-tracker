// Fake push services for tests: a `fetch` that answers Web Push endpoints and
// the Expo API from per-test configuration and records every request.
import { base64UrlEncode, type VapidKeys } from "../src/push/webpush.ts";

export async function newVapidKeys(): Promise<VapidKeys> {
	const pair = (await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"]
	)) as CryptoKeyPair;
	const publicKey = (await crypto.subtle.exportKey(
		"raw",
		pair.publicKey
	)) as ArrayBuffer;
	const jwk = (await crypto.subtle.exportKey(
		"jwk",
		pair.privateKey
	)) as JsonWebKey;
	return {
		publicKey: base64UrlEncode(publicKey),
		privateKey: jwk.d!,
		subject: "mailto:owner@example.com",
	};
}

/** A browser-like subscription key pair (`keys.p256dh`, `keys.auth`). */
export async function newWebPushKeys(): Promise<{
	p256dh: string;
	auth: string;
}> {
	const pair = (await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"]
	)) as CryptoKeyPair;
	const publicKey = (await crypto.subtle.exportKey(
		"raw",
		pair.publicKey
	)) as ArrayBuffer;
	return {
		p256dh: base64UrlEncode(publicKey),
		auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
	};
}

export const EXPO_SEND = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";

type ExpoTicketReply =
	| { status: "ok"; id: string }
	| { status: "error"; details: { error: string } };

export interface FakePushOptions {
	/** HTTP status per Web Push endpoint (default 201). */
	web?: Record<string, number>;
	/** Ticket per Expo token (default: ok with a generated id). */
	expoTickets?: Record<string, ExpoTicketReply>;
	/** Receipt per ticket id (absent ids are "not ready"). */
	receipts?: Record<
		string,
		{ status: "ok" } | { status: "error"; details: { error: string } }
	>;
	/** Makes the Expo send request itself fail with this HTTP status. */
	expoSendStatus?: number;
}

export interface RecordedRequest {
	url: string;
	headers: Headers;
	body: string | Uint8Array;
}

export function fakePushFetch(options: FakePushOptions = {}) {
	const requests: RecordedRequest[] = [];
	let ticketCount = 0;

	const fetcher: typeof fetch = async (input, init) => {
		const request = new Request(input, init);
		const isExpo = request.url.startsWith("https://exp.host/");
		const body = isExpo
			? await request.text()
			: new Uint8Array(await request.arrayBuffer());
		requests.push({ url: request.url, headers: request.headers, body });

		if (request.url === EXPO_SEND) {
			if (options.expoSendStatus) {
				return new Response("unavailable", { status: options.expoSendStatus });
			}
			const messages = JSON.parse(body as string) as { to: string }[];
			const data = messages.map(
				({ to }) =>
					options.expoTickets?.[to] ?? {
						status: "ok",
						id: `ticket-${++ticketCount}`,
					}
			);
			return Response.json({ data });
		}
		if (request.url === EXPO_RECEIPTS) {
			const { ids } = JSON.parse(body as string) as { ids: string[] };
			const data = Object.fromEntries(
				ids.flatMap((id) =>
					options.receipts?.[id] ? [[id, options.receipts[id]]] : []
				)
			);
			return Response.json({ data });
		}
		return new Response(null, { status: options.web?.[request.url] ?? 201 });
	};

	return {
		fetch: fetcher,
		requests,
		/** Requests to Web Push endpoints. */
		web: () => requests.filter((r) => !r.url.startsWith("https://exp.host/")),
		/** Expo send requests, as their parsed message arrays. */
		expoSends: () =>
			requests
				.filter((r) => r.url === EXPO_SEND)
				.map((r) => JSON.parse(r.body as string) as Record<string, unknown>[]),
		receiptRequests: () => requests.filter((r) => r.url === EXPO_RECEIPTS),
		clear: () => {
			requests.length = 0;
		},
	};
}
