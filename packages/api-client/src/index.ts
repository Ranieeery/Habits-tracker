// Typed API client shared by web and mobile, built on Hono RPC: request and
// response types come from the API routes (`api/app`), whose schemas come from
// `@habits/contracts`.
//
//   const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL });
//   const { habits } = await unwrap(api.v1.habits.$get());

import {
	ApiError,
	SCHEDULE_VERSION,
	SCHEDULE_VERSION_HEADER,
} from "@habits/contracts";
import type { AppType } from "api/app";
import { type ClientResponse, hc } from "hono/client";
import type { SuccessStatusCode } from "hono/utils/http-status";

export { API_VERSION } from "@habits/contracts";
export type { AppType };

export interface ApiClientOptions {
	/** Where the API is served, without `/v1` (e.g. `http://localhost:8787`). */
	baseUrl: string;
	/**
	 * Session token for `Authorization: Bearer` (mobile). Read on every
	 * request, so a refreshed token is picked up.
	 */
	getToken?: () =>
		string | null | undefined | Promise<string | null | undefined>;
	/** `"include"` sends the session cookie cross-origin (web in development). */
	credentials?: RequestCredentials;
	/** Custom fetch (tests, or a platform-specific implementation). */
	fetch?: typeof fetch;
}

export function createApiClient({
	baseUrl,
	getToken,
	credentials,
	fetch: customFetch,
}: ApiClientOptions) {
	return hc<AppType>(baseUrl, {
		fetch: customFetch,
		init: credentials ? { credentials } : undefined,
		headers: async (): Promise<Record<string, string>> => {
			const token = await getToken?.();
			// Lets the API send schedule types this build understands (older
			// builds without the header only get weekday habits).
			const version = { [SCHEDULE_VERSION_HEADER]: String(SCHEDULE_VERSION) };
			return token ? { ...version, Authorization: `Bearer ${token}` } : version;
		},
	});
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** A non-2xx response, with the `ApiError` code from the body when present. */
export class ApiClientError extends Error {
	readonly status: number;
	/** One of `ERROR_CODES`, or `"unknown"` for a body that is not an `ApiError`. */
	readonly code: string;
	readonly details: unknown;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: unknown
	) {
		super(message);
		this.name = "ApiClientError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

/** The body type of the 2xx responses of a route (`undefined` for 204). */
export type SuccessBody<R> =
	R extends ClientResponse<infer T, infer S, infer F>
		? S extends SuccessStatusCode
			? F extends "json"
				? T
				: undefined
			: never
		: never;

/**
 * Awaits a client call and returns its 2xx body, or throws `ApiClientError`
 * with the `ApiError` code of the response.
 */
export async function unwrap<R extends ClientResponse<unknown, number, string>>(
	request: R | Promise<R>
): Promise<SuccessBody<R>> {
	const response = await request;
	if (response.ok) {
		if (response.status === 204) return undefined as SuccessBody<R>;
		return (await response.json()) as SuccessBody<R>;
	}
	const body: unknown = await response.json().catch(() => null);
	const parsed = ApiError.safeParse(body);
	if (parsed.success) {
		const { code, message, details } = parsed.data.error;
		throw new ApiClientError(response.status, code, message, details);
	}
	throw new ApiClientError(
		response.status,
		"unknown",
		`Request failed with status ${response.status}`
	);
}
