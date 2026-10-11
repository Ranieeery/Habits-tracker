// The sync engine's view of the server: push, pull and settings, with every
// failure classified as offline, transient (retry with backoff), unauthorized
// or a permanent rejection of the whole request.
import {
	type ApiErrorBody,
	type Mutation,
	type MutationResult,
	SYNC_PROTOCOL_VERSION,
	SyncPullResponse,
	SyncPushResponse,
	type UserSettings,
	UserSettingsResponse,
} from "@habits/contracts";
import { type ApiClient, ApiClientError, unwrap } from "@habits/api-client";

export type TransportFailure =
	/** No connection, DNS failure, timeout. */
	| { kind: "offline" }
	/** 5xx, 408, 429: try again later (`retryAfterMs` from `Retry-After`). */
	| { kind: "transient"; status: number; retryAfterMs: number | null }
	/** The session is gone: sign in again. */
	| { kind: "unauthorized" }
	/** Another 4xx for the whole request: sending it again will not help. */
	| { kind: "rejected"; status: number; error: ApiErrorBody };

export class TransportError extends Error {
	readonly failure: TransportFailure;

	constructor(failure: TransportFailure, options?: ErrorOptions) {
		super(`Sync request failed: ${failure.kind}`, options);
		this.name = "TransportError";
		this.failure = failure;
	}
}

/** `Retry-After` as delta-seconds or an HTTP date, in ms from `nowMs`. */
export function parseRetryAfter(
	value: string | null,
	nowMs: number
): number | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
	const date = Date.parse(trimmed);
	return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

/** Classifies anything a request can throw. */
export function classifyFailure(
	error: unknown,
	retryAfterMs: number | null = null
): TransportFailure {
	if (error instanceof TransportError) return error.failure;
	if (error instanceof ApiClientError) {
		const { status } = error;
		if (status === 401) return { kind: "unauthorized" };
		if (status === 408 || status === 429 || status >= 500) {
			return { kind: "transient", status, retryAfterMs };
		}
		return {
			kind: "rejected",
			status,
			error: {
				code: error.code,
				message: error.message,
				...(error.details === undefined ? {} : { details: error.details }),
			},
		};
	}
	// `fetch` rejects with a TypeError when the server cannot be reached, and
	// with an AbortError on our timeout.
	if (
		error instanceof TypeError ||
		(error instanceof Error && error.name === "AbortError")
	) {
		return { kind: "offline" };
	}
	return { kind: "transient", status: 0, retryAfterMs: null };
}

export interface SyncTransport {
	push(mutations: readonly Mutation[]): Promise<MutationResult[]>;
	pull(cursor: string | null, limit: number): Promise<SyncPullResponse>;
	getSettings(): Promise<UserSettings>;
	/**
	 * Server clock minus device clock (ms) from the last response's `Date`
	 * header, or null before the first response.
	 */
	clockSkewMs(): number | null;
}

/** What the transport learns from each response. */
export interface ResponseObserver {
	lastRetryAfterMs(): number | null;
	clockSkewMs(): number | null;
}

/**
 * Wraps `fetch` with a timeout and remembers the `Date` and `Retry-After`
 * headers of the last response.
 */
export function observingFetch(
	base: typeof fetch,
	now: () => number,
	timeoutMs: number
): { fetch: typeof fetch; observer: ResponseObserver } {
	let retryAfter: number | null = null;
	let skew: number | null = null;
	const wrapped: typeof fetch = async (input, init) => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await base(input, {
				...init,
				signal: controller.signal,
			});
			const at = now();
			retryAfter = parseRetryAfter(response.headers.get("retry-after"), at);
			const serverDate = Date.parse(response.headers.get("date") ?? "");
			if (!Number.isNaN(serverDate)) skew = serverDate - at;
			return response;
		} finally {
			clearTimeout(timer);
		}
	};
	return {
		fetch: wrapped,
		observer: {
			lastRetryAfterMs: () => retryAfter,
			clockSkewMs: () => skew,
		},
	};
}

export function createSyncTransport(
	api: ApiClient,
	observer: ResponseObserver
): SyncTransport {
	async function call<T>(request: () => Promise<T>): Promise<T> {
		try {
			return await request();
		} catch (error) {
			throw new TransportError(
				classifyFailure(error, observer.lastRetryAfterMs()),
				{ cause: error }
			);
		}
	}
	return {
		push: (mutations) =>
			call(async () => {
				const body = await unwrap(
					api.v1.sync.push.$post({
						json: {
							protocol: SYNC_PROTOCOL_VERSION,
							mutations: [...mutations],
						},
					})
				);
				return SyncPushResponse.parse(body).results;
			}),
		pull: (cursor, limit) =>
			call(async () => {
				const body = await unwrap(
					api.v1.sync.pull.$get({
						query: {
							...(cursor ? { cursor } : {}),
							limit: String(limit),
						},
					})
				);
				return SyncPullResponse.parse(body);
			}),
		getSettings: () =>
			call(
				async () =>
					UserSettingsResponse.parse(await unwrap(api.v1.settings.$get()))
						.settings
			),
		clockSkewMs: () => observer.clockSkewMs(),
	};
}
