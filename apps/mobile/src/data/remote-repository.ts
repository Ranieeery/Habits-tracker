// `HabitsRepository` over the HTTP API, the authenticated `fetch`, and push
// device registration. Since Phase 7 the app reads and writes habits through
// the local repository; this one only serves settings (and push). With
// `sync/transport.ts`, the only modules that talk to `@habits/api-client`.
import { type ApiClient, createApiClient, unwrap } from "@habits/api-client";
import { DataError, toDataError } from "./errors.ts";
import type {
	HabitsRepository,
	NotificationsRepository,
} from "./repository.ts";

/** Runs a request and turns any failure into a `DataError`. */
async function call<T>(request: () => Promise<T>): Promise<T> {
	try {
		return await request();
	} catch (error) {
		throw toDataError(error);
	}
}

export function createRemoteRepository(api: ApiClient): HabitsRepository {
	return {
		getSettings: () =>
			call(async () => (await unwrap(api.v1.settings.$get())).settings),
		updateSettings: (changes) =>
			call(
				async () =>
					(await unwrap(api.v1.settings.$patch({ json: changes }))).settings
			),

		listHabits: () =>
			call(async () => (await unwrap(api.v1.habits.$get())).habits),
		createHabit: (input) =>
			call(
				async () => (await unwrap(api.v1.habits.$post({ json: input }))).habit
			),
		updateHabit: (habitId, changes) =>
			call(
				async () =>
					(
						await unwrap(
							api.v1.habits[":habit_id"].$patch({
								param: { habit_id: habitId },
								json: changes,
							})
						)
					).habit
			),

		getDay: (date) => call(() => unwrap(api.v1.day.$get({ query: { date } }))),
		// The API has no per-habit summary; the app reads it from the device
		// database (local repository), so a filter here is a programming error.
		getYearSummary: (year, options) =>
			options?.habitId
				? Promise.reject(
						new DataError("unknown", "Per-habit summary is local only")
					)
				: call(
						async () =>
							(
								await unwrap(
									api.v1.summary.$get({ query: { year: String(year) } })
								)
							).days
					),
		setCompletion: (habitId, date, completed) =>
			call(async () => {
				await unwrap(
					api.v1.habits[":habit_id"].completions[":date"].$put({
						param: { habit_id: habitId, date },
						json: { completed },
					})
				);
			}),
	};
}

export function createRemoteNotifications(
	api: ApiClient
): NotificationsRepository {
	return {
		registerDevice: (token, label) =>
			call(
				async () =>
					(
						await unwrap(
							api.v1.push.subscriptions.$post({
								json: {
									kind: "expo",
									token,
									...(label ? { device_label: label } : {}),
								},
							})
						)
					).subscription.id
			),
		unregisterDevice: (deviceId) =>
			call(async () => {
				await unwrap(
					api.v1.push.subscriptions[":subscription_id"].$delete({
						param: { subscription_id: deviceId },
					})
				);
			}),
		sendTest: () => call(() => unwrap(api.v1.push.test.$post())),
	};
}

/**
 * `fetch` that authenticates with the Better Auth session cookie kept in
 * SecureStore. `credentials: "omit"` keeps the native cookie jar out of it,
 * as the Better Auth Expo docs recommend.
 */
export function authenticatedFetch(
	getCookie: () => Promise<string>
): typeof fetch {
	return async (input, init) => {
		const headers = new Headers(init?.headers);
		const cookie = await getCookie();
		if (cookie) headers.set("cookie", cookie);
		return fetch(input, { ...init, headers, credentials: "omit" });
	};
}

export function createAuthenticatedApiClient(
	baseUrl: string,
	fetcher: typeof fetch
): ApiClient {
	return createApiClient({ baseUrl, fetch: fetcher });
}
