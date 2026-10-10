// `HabitsRepository` over the HTTP API. The only module that talks to
// `@habits/api-client`.
import { type ApiClient, createApiClient, unwrap } from "@habits/api-client";
import { toDataError } from "./errors.ts";
import type { HabitsRepository } from "./repository.ts";

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
		getYearSummary: (year) =>
			call(
				async () =>
					(await unwrap(api.v1.summary.$get({ query: { year: String(year) } })))
						.days
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

/**
 * API client that authenticates with the Better Auth session cookie kept in
 * SecureStore. `credentials: "omit"` keeps the native cookie jar out of it,
 * as the Better Auth Expo docs recommend.
 */
export function createAuthenticatedApiClient(
	baseUrl: string,
	getCookie: () => Promise<string>
): ApiClient {
	const authenticatedFetch: typeof fetch = async (input, init) => {
		const headers = new Headers(init?.headers);
		const cookie = await getCookie();
		if (cookie) headers.set("cookie", cookie);
		return fetch(input, { ...init, headers, credentials: "omit" });
	};
	return createApiClient({ baseUrl, fetch: authenticatedFetch });
}
