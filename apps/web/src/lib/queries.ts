// TanStack Query keys and options for every server resource. Components use
// these instead of calling the API client directly.
import { type ApiClient, unwrap } from "@habits/api-client";
import type {
	CalendarDate,
	CreateHabitRequest,
	DayResponse,
	UpdateHabitRequest,
	UpdateUserSettingsRequest,
} from "@habits/contracts";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { AuthService } from "./auth.ts";
import type { BrowserSubscription } from "./push.ts";

export const queryKeys = {
	session: ["session"] as const,
	settings: ["settings"] as const,
	habits: ["habits"] as const,
	days: ["day"] as const,
	day: (date: CalendarDate) => ["day", date] as const,
	summaries: ["summary"] as const,
	summary: (year: number) => ["summary", year] as const,
};

export function sessionQuery(auth: AuthService) {
	return queryOptions({
		queryKey: queryKeys.session,
		queryFn: () => auth.getSession(),
		staleTime: 5 * 60_000,
	});
}

export function settingsQuery(api: ApiClient) {
	return queryOptions({
		queryKey: queryKeys.settings,
		queryFn: async () => (await unwrap(api.v1.settings.$get())).settings,
	});
}

export function habitsQuery(api: ApiClient) {
	return queryOptions({
		queryKey: queryKeys.habits,
		queryFn: async () => (await unwrap(api.v1.habits.$get())).habits,
	});
}

export function dayQuery(api: ApiClient, date: CalendarDate) {
	return queryOptions({
		queryKey: queryKeys.day(date),
		queryFn: (): Promise<DayResponse> =>
			unwrap(api.v1.day.$get({ query: { date } })),
	});
}

export function summaryQuery(api: ApiClient, year: number) {
	return queryOptions({
		queryKey: queryKeys.summary(year),
		queryFn: async () =>
			(await unwrap(api.v1.summary.$get({ query: { year: String(year) } })))
				.days,
	});
}

export function setCompletion(
	api: ApiClient,
	habitId: string,
	date: CalendarDate,
	completed: boolean
) {
	return unwrap(
		api.v1.habits[":habit_id"].completions[":date"].$put({
			param: { habit_id: habitId, date },
			json: { completed },
		})
	);
}

export async function createHabit(api: ApiClient, body: CreateHabitRequest) {
	return (await unwrap(api.v1.habits.$post({ json: body }))).habit;
}

export async function updateHabit(
	api: ApiClient,
	habitId: string,
	body: UpdateHabitRequest
) {
	return (
		await unwrap(
			api.v1.habits[":habit_id"].$patch({
				param: { habit_id: habitId },
				json: body,
			})
		)
	).habit;
}

export async function updateSettings(
	api: ApiClient,
	body: UpdateUserSettingsRequest
) {
	return (await unwrap(api.v1.settings.$patch({ json: body }))).settings;
}

/** After a habit or completion change: lists, days and heatmaps refetch. */
export function invalidateHabitData(queryClient: QueryClient) {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: queryKeys.habits }),
		queryClient.invalidateQueries({ queryKey: queryKeys.days }),
		queryClient.invalidateQueries({ queryKey: queryKeys.summaries }),
	]);
}

/** Registers (or refreshes) this browser; returns the API's id for it. */
export async function registerWebPush(
	api: ApiClient,
	subscription: BrowserSubscription,
	deviceLabel: string | null
) {
	const { subscription: stored } = await unwrap(
		api.v1.push.subscriptions.$post({
			json: {
				kind: "webpush",
				endpoint: subscription.endpoint,
				keys: subscription.keys,
				...(deviceLabel ? { device_label: deviceLabel } : {}),
			},
		})
	);
	return stored.id;
}

export function deletePushSubscription(api: ApiClient, subscriptionId: string) {
	return unwrap(
		api.v1.push.subscriptions[":subscription_id"].$delete({
			param: { subscription_id: subscriptionId },
		})
	);
}

export function sendTestPush(api: ApiClient) {
	return unwrap(api.v1.push.test.$post());
}
