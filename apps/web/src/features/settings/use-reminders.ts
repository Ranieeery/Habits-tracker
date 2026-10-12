import type {
	ReminderTime,
	UpdateUserSettingsRequest,
	UserSettings,
} from "@habits/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import {
	deletePushSubscription,
	queryKeys,
	registerWebPush,
	sendTestPush,
	updateSettings,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";
import { ApiClientError } from "@habits/api-client";

export const DEFAULT_REMINDER_TIME = "20:00";

/** Saves the account's reminder time; null turns reminders off. */
export function useSaveReminderTime() {
	const { api } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (reminder_time: ReminderTime | null) =>
			updateSettings(api, { reminder_time }),
		onSuccess: (settings) =>
			queryClient.setQueryData(queryKeys.settings, settings),
		onError: (error) => {
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar o lembrete", {
					description: errorMessage(error),
				});
			}
		},
	});
}

type NotificationFlags = Pick<
	UpdateUserSettingsRequest,
	"morning_digest_enabled" | "show_titles_in_notifications"
>;

/**
 * Saves the morning digest and title preferences optimistically: the switch
 * moves at once and goes back if saving fails.
 */
export function useSaveNotificationFlags() {
	const { api } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (changes: NotificationFlags) => updateSettings(api, changes),
		onMutate: async (changes) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.settings });
			const previous = queryClient.getQueryData<UserSettings>(
				queryKeys.settings
			);
			if (previous) {
				queryClient.setQueryData<UserSettings>(queryKeys.settings, {
					...previous,
					...changes,
				});
			}
			return { previous };
		},
		onError: (error, _changes, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.settings, context.previous);
			}
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar a preferência", {
					description: errorMessage(error),
				});
			}
		},
		onSuccess: (settings) =>
			queryClient.setQueryData(queryKeys.settings, settings),
	});
}

export type EnableOutcome = "enabled" | "denied" | "unsupported";

/**
 * Turns the morning digest on and makes sure this browser can receive it
 * (permission asked only now, from the click). The setting is saved even
 * when this browser refuses: other devices still get the digest.
 */
export function useEnableDigest() {
	const { api, push } = useServices();
	const save = useSaveNotificationFlags();
	return useMutation({
		mutationFn: async (): Promise<EnableOutcome> => {
			const result = await push.enable();
			if (result.status === "subscribed") {
				push.storeId(
					await registerWebPush(api, result.subscription, push.deviceLabel())
				);
			}
			await save.mutateAsync({ morning_digest_enabled: true });
			return result.status === "subscribed" ? "enabled" : result.status;
		},
	});
}

/**
 * Turns reminders on: asks this browser for permission (only now, from the
 * click), registers it with the API, then saves the reminder time. When the
 * browser refuses, nothing is saved and the caller explains why.
 */
export function useEnableReminders() {
	const { api, push } = useServices();
	const save = useSaveReminderTime();
	return useMutation({
		mutationFn: async (time: ReminderTime): Promise<EnableOutcome> => {
			const result = await push.enable();
			if (result.status !== "subscribed") return result.status;
			push.storeId(
				await registerWebPush(api, result.subscription, push.deviceLabel())
			);
			await save.mutateAsync(time);
			return "enabled";
		},
		onError: (error) => {
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível ativar os lembretes", {
					description: errorMessage(error),
				});
			}
		},
	});
}

export function useSendTestPush() {
	const { api } = useServices();
	return useMutation({
		mutationFn: () => sendTestPush(api),
		onSuccess: ({ sent, failed }) => {
			if (sent > 0) {
				toast.success("Notificação de teste enviada", {
					description:
						failed > 0
							? `${sent} aparelho(s) receberam; ${failed} falharam e serão tentados de novo.`
							: `Enviada para ${sent} aparelho(s).`,
				});
			} else {
				toast.error("Nenhum aparelho recebeu o teste", {
					description:
						"Ative as notificações neste navegador ou no app para receber lembretes.",
				});
			}
		},
		onError: (error) => {
			if (isUnauthorized(error)) return;
			if (error instanceof ApiClientError && error.status === 429) {
				toast.error("Aguarde um minuto", {
					description: "Só é possível enviar um teste por minuto.",
				});
				return;
			}
			toast.error("Não foi possível enviar o teste", {
				description: errorMessage(error),
			});
		},
	});
}

/**
 * With permission already granted, re-registers this browser when the app
 * opens: refreshes `last_seen_at` and picks up a rotated subscription. Never
 * asks for permission.
 */
export function useRefreshPushSubscription() {
	const { api, push } = useServices();
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const subscription = await push.current();
				if (!subscription || cancelled) return;
				push.storeId(
					await registerWebPush(api, subscription, push.deviceLabel())
				);
			} catch {
				// Best effort: the next visit tries again.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [api, push]);
}

/** Before signing out: forget this browser in the API and unsubscribe it. */
export async function unregisterThisBrowser(
	services: Pick<ReturnType<typeof useServices>, "api" | "push">
) {
	const id = services.push.storedId();
	try {
		if (id) await deletePushSubscription(services.api, id);
	} catch {
		// Offline or already gone: unsubscribing below makes the push service
		// answer 410, and the API removes the device on the next send.
	}
	try {
		await services.push.disable();
	} catch {
		// Nothing else to do.
	}
	services.push.storeId(null);
}
