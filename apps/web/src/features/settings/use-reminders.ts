import type { ReminderTime } from "@habits/contracts";
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

export type EnableOutcome = "enabled" | "denied" | "unsupported";

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
