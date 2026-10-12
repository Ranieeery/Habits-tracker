// The data hooks the screens use. They only know the repository interface
// (local-first since Phase 7: the device database plus sync), so screens never
// know where data comes from or whether it is synced yet.
import type {
	CalendarDate,
	CreateHabitRequest,
	SummaryDay,
	UpdateHabitRequest,
} from "@habits/contracts";
import { parseCalendarDate } from "@habits/core";
import {
	type QueryClient,
	useMutation,
	usePrefetchQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import type { SessionState } from "./auth.ts";
import {
	type CompletionChange,
	withCompletion,
	withSummaryDay,
} from "./optimistic.ts";
import { unregisterThisDevice } from "./push-registration.ts";
import type { DayData } from "./repository.ts";
import { prepareLocalData, useServices } from "./services.ts";
import { unregisterBackgroundSync } from "./sync/background.ts";

export {
	useDiscardFailures,
	useRetryFailures,
	useRunBackgroundSync,
	useSyncAndCountUnsynced,
	useSyncFailures,
	useSyncNow,
	useSyncStatus,
} from "./sync/hooks.ts";

export const queryKeys = {
	session: ["session"] as const,
	settings: ["settings"] as const,
	habits: ["habits"] as const,
	days: ["day"] as const,
	day: (date: CalendarDate) => ["day", date] as const,
	summaries: ["summary"] as const,
	summary: (year: number) => ["summary", year] as const,
};

/** After a habit or completion change: lists, days and heatmaps refetch. */
export function invalidateHabitData(queryClient: QueryClient) {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: queryKeys.habits }),
		queryClient.invalidateQueries({ queryKey: queryKeys.days }),
		queryClient.invalidateQueries({ queryKey: queryKeys.summaries }),
	]);
}

/**
 * Pull-to-refresh on the home screen: the year, the habits and every cached
 * day, including the ones no screen shows right now (e.g. today, prefetched
 * for the "Hoje" button), so opening a day afterwards shows fresh data.
 */
export function useRefreshAll() {
	const { sync } = useServices();
	const queryClient = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);
	const refresh = async () => {
		setRefreshing(true);
		try {
			// Bring the device database up to date first (no-op offline).
			await sync.sync("manual");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: queryKeys.summaries }),
				queryClient.invalidateQueries({ queryKey: queryKeys.habits }),
				queryClient.invalidateQueries({
					queryKey: queryKeys.days,
					refetchType: "all",
				}),
			]);
		} finally {
			setRefreshing(false);
		}
	};
	return { refresh, refreshing };
}

/** Whether a query has an answer to show (data, error, or paused offline). */
export function isSettled(query: {
	isPending: boolean;
	fetchStatus: string;
}): boolean {
	return !query.isPending || query.fetchStatus === "paused";
}

// Session

export function useSession() {
	const services = useServices();
	return useQuery({
		queryKey: queryKeys.session,
		queryFn: async () => {
			const session = await services.auth.restoreSession();
			if (session.status === "signed_in") {
				if (session.user) {
					await prepareLocalData(services, session.user.id);
				} else if (await services.local.getMeta("user_id")) {
					// Offline with a stored session: the data on the device is
					// that session's user's (sign-in checked it).
					await services.sync.refresh();
					services.sync.start();
				}
			}
			return session;
		},
		// Checked once per launch; any 401 afterwards signs out.
		staleTime: Infinity,
		gcTime: Infinity,
		retry: false,
		networkMode: "always",
	});
}

/** Forgets every cached record and marks the session as signed out. */
export function resetToSignedOut(queryClient: QueryClient) {
	const session: SessionState = { status: "signed_out" };
	queryClient.setQueryData(queryKeys.session, session);
	queryClient.removeQueries({
		predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
	});
}

export function useSignIn() {
	const services = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (
			credentials: Parameters<typeof services.auth.signIn>[0]
		) => {
			const user = await services.auth.signIn(credentials);
			// Another user's data on this device is wiped before anything shows.
			await prepareLocalData(services, user.id);
			return user;
		},
		networkMode: "always",
		onSuccess: (user) => {
			const session: SessionState = { status: "signed_in", user };
			queryClient.setQueryData(queryKeys.session, session);
		},
	});
}

export function useSignOut() {
	const services = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await services.sync.stop();
			await unregisterBackgroundSync();
			// While the session exists: this device stops receiving reminders.
			await unregisterThisDevice(services);
			await services.auth.signOut();
			// Pending changes are lost here: the settings screen warns first.
			await services.local.wipe();
		},
		networkMode: "always",
		onSettled: () => resetToSignedOut(queryClient),
	});
}

// Settings

export function useSettings() {
	const { repository } = useServices();
	return useQuery({
		queryKey: queryKeys.settings,
		queryFn: () => repository.getSettings(),
	});
}

export function useUpdateTimeZone() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (timezone: string) => repository.updateSettings({ timezone }),
		onSuccess: (settings) => {
			queryClient.setQueryData(queryKeys.settings, settings);
			return invalidateHabitData(queryClient);
		},
	});
}

// Habits

export function useHabits() {
	const { repository } = useServices();
	return useQuery({
		queryKey: queryKeys.habits,
		queryFn: () => repository.listHabits(),
	});
}

/**
 * The id generator (UUID v7) for records a screen creates: a form takes one
 * id per opening, so submitting twice never creates two records.
 */
export function useNewId(): () => string {
	return useServices().newId;
}

export function useCreateHabit() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateHabitRequest) => repository.createHabit(input),
		onSuccess: () => invalidateHabitData(queryClient),
	});
}

export function useUpdateHabit() {
	const { repository } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			habitId,
			changes,
		}: {
			habitId: string;
			changes: UpdateHabitRequest;
		}) => repository.updateHabit(habitId, changes),
		onSuccess: () => invalidateHabitData(queryClient),
	});
}

// Days and heatmap

export function useDay(date: CalendarDate) {
	const { repository } = useServices();
	return useQuery({
		queryKey: queryKeys.day(date),
		queryFn: () => repository.getDay(date),
	});
}

/** Loads a day in the background (e.g. today, while the heatmap is open). */
export function usePrefetchDay(date: CalendarDate) {
	const { repository } = useServices();
	usePrefetchQuery({
		queryKey: queryKeys.day(date),
		queryFn: () => repository.getDay(date),
	});
}

export function useYearSummary(
	year: number,
	{ enabled = true }: { enabled?: boolean } = {}
) {
	const { repository } = useServices();
	return useQuery({
		queryKey: queryKeys.summary(year),
		queryFn: () => repository.getYearSummary(year),
		enabled,
	});
}

/**
 * Marks a habit done/undone on `date`. The day updates at once and rolls back
 * if the write fails; the heatmap refetches afterwards. `onError` lets the
 * screen show feedback (401s are already handled globally).
 */
export function useToggleCompletion(
	date: CalendarDate,
	onError?: (error: Error) => void
) {
	const { repository } = useServices();
	const key = queryKeys.day(date);
	const summaryKey = queryKeys.summary(parseCalendarDate(date).year);
	const mutationKey = ["completion", date];

	return useMutation({
		mutationKey,
		mutationFn: ({ habitId, completed }: CompletionChange) =>
			repository.setCompletion(habitId, date, completed),
		onMutate: async (change, { client }) => {
			// A refetch in flight would overwrite the optimistic values.
			await Promise.all([
				client.cancelQueries({ queryKey: key }),
				client.cancelQueries({ queryKey: summaryKey }),
			]);
			const previous = client.getQueryData<DayData>(key);
			const previousSummary = client.getQueryData<SummaryDay[]>(summaryKey);
			if (previous) {
				const next = withCompletion(previous, change);
				client.setQueryData<DayData>(key, next);
				// The heatmap cell follows at once, not after a refetch.
				if (previousSummary) {
					client.setQueryData(
						summaryKey,
						withSummaryDay(previousSummary, next)
					);
				}
			}
			return { previous, previousSummary };
		},
		onError: (error, _change, result, { client }) => {
			if (result?.previous) client.setQueryData(key, result.previous);
			if (result?.previousSummary) {
				client.setQueryData(summaryKey, result.previousSummary);
			}
			onError?.(error);
		},
		onSettled: (_data, _error, _change, _result, { client }) => {
			// With several quick toggles, refetch only after the last one:
			// an earlier refetch would briefly undo the pending ones.
			if (client.isMutating({ mutationKey }) > 1) return;
			return Promise.all([
				client.invalidateQueries({ queryKey: key }),
				client.invalidateQueries({ queryKey: queryKeys.summaries }),
			]);
		},
	});
}
