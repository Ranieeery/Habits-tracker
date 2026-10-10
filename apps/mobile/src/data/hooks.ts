// The data hooks the screens use. They only know the repository interface, so
// Phase 7 can move the source to the local database without touching screens.
import type {
	CalendarDate,
	CreateHabitRequest,
	UpdateHabitRequest,
} from "@habits/contracts";
import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { SessionState } from "./auth.ts";
import { type CompletionChange, withCompletion } from "./optimistic.ts";
import { unregisterThisDevice } from "./push-registration.ts";
import type { DayData } from "./repository.ts";
import { useServices } from "./services.ts";

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

/** Whether a query has an answer to show (data, error, or paused offline). */
export function isSettled(query: {
	isPending: boolean;
	fetchStatus: string;
}): boolean {
	return !query.isPending || query.fetchStatus === "paused";
}

// Session

export function useSession() {
	const { auth } = useServices();
	return useQuery({
		queryKey: queryKeys.session,
		queryFn: () => auth.restoreSession(),
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
	const { auth } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: auth.signIn,
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
			// While the session exists: this device stops receiving reminders.
			await unregisterThisDevice(services);
			await services.auth.signOut();
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

export function useYearSummary(year: number) {
	const { repository } = useServices();
	return useQuery({
		queryKey: queryKeys.summary(year),
		queryFn: () => repository.getYearSummary(year),
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

	return useMutation({
		mutationKey: ["completion", date],
		mutationFn: ({ habitId, completed }: CompletionChange) =>
			repository.setCompletion(habitId, date, completed),
		onMutate: async (change, { client }) => {
			// A refetch in flight would overwrite the optimistic value.
			await client.cancelQueries({ queryKey: key });
			const previous = client.getQueryData<DayData>(key);
			if (previous) {
				client.setQueryData<DayData>(key, withCompletion(previous, change));
			}
			return { previous };
		},
		onError: (error, _change, result, { client }) => {
			if (result?.previous) client.setQueryData(key, result.previous);
			onError?.(error);
		},
		onSettled: (_data, _error, _change, _result, { client }) =>
			Promise.all([
				client.invalidateQueries({ queryKey: key }),
				client.invalidateQueries({ queryKey: queryKeys.summaries }),
			]),
	});
}
