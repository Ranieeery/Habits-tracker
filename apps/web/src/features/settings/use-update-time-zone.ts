import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors.ts";
import {
	invalidateHabitData,
	queryKeys,
	updateSettings,
} from "@/lib/queries.ts";
import { isUnauthorized } from "@/lib/query-client.ts";
import { useServices } from "@/lib/services.ts";

/** Saves the user's time zone; "today" and every day view follow it. */
export function useUpdateTimeZone() {
	const { api } = useServices();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (timezone: string) => updateSettings(api, { timezone }),
		onSuccess: (settings) => {
			queryClient.setQueryData(queryKeys.settings, settings);
			toast.success("Fuso horário atualizado", {
				description: settings.timezone,
			});
			return invalidateHabitData(queryClient);
		},
		onError: (error) => {
			if (!isUnauthorized(error)) {
				toast.error("Não foi possível salvar o fuso", {
					description: errorMessage(error),
				});
			}
		},
	});
}
