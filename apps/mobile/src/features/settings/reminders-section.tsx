import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReminderTime } from "@habits/contracts";
import { colors } from "@habits/design-tokens";
import { useState } from "react";
import { Linking, Pressable, Switch, Text, View } from "react-native";
import { errorMessage, isUnauthorized, toDataError } from "@/data/errors.ts";
import {
	DEFAULT_REMINDER_TIME,
	type EnableOutcome,
	usePushPermission,
	useEnableReminders,
	useSaveReminderTime,
	useSendTestPush,
} from "@/data/push-hooks.ts";
import type { PushPermission } from "@/data/push-logic.ts";
import { useLoadedSettings } from "@/data/today.ts";
import { Button } from "@/ui/button.tsx";
import { TextField } from "@/ui/text-field.tsx";
import { useToast } from "@/ui/toast.tsx";

const DEVICE_STATUS: Record<PushPermission | EnableOutcome, string | null> = {
	granted: "Este aparelho recebe os lembretes.",
	enabled: "Este aparelho recebe os lembretes.",
	undetermined: null,
	denied:
		"Notificações bloqueadas para o Habits. Sem isso, este aparelho não recebe lembretes. Libere em Configurações > Apps > Habits > Notificações. O horário salvo continua valendo para seus outros aparelhos.",
	unavailable:
		"Não foi possível ativar as notificações neste aparelho (emulador sem Google Play ou app sem a configuração do Firebase).",
};

/** Daily reminder on/off and time (account-wide), plus this device's status. */
export function RemindersSection() {
	const settings = useLoadedSettings();
	const reminderTime = settings.reminder_time;
	const enabled = reminderTime !== null;
	const permission = usePushPermission();
	const enable = useEnableReminders();
	const save = useSaveReminderTime();
	const sendTest = useSendTestPush();
	const toast = useToast();
	const [outcome, setOutcome] = useState<EnableOutcome | null>(null);
	const [time, setTime] = useState(reminderTime ?? DEFAULT_REMINDER_TIME);
	const [timeError, setTimeError] = useState<string>();

	const state = outcome ?? permission.data ?? null;
	const status = state ? DEVICE_STATUS[state] : null;
	const busy = enable.isPending || save.isPending;

	const onError = (title: string) => (error: Error) => {
		if (!isUnauthorized(error)) toast("error", title, errorMessage(error));
	};

	const toggle = (on: boolean) => {
		if (!on) {
			save.mutate(null, { onError: onError("Não foi possível salvar") });
			return;
		}
		const parsed = ReminderTime.safeParse(time);
		enable.mutate(parsed.success ? parsed.data : DEFAULT_REMINDER_TIME, {
			onSuccess: setOutcome,
			onError: onError("Não foi possível ativar os lembretes"),
		});
	};

	const saveTime = () => {
		const parsed = ReminderTime.safeParse(time.trim());
		if (!parsed.success) {
			setTimeError("Use o formato HH:MM, por exemplo 20:00.");
			return;
		}
		setTimeError(undefined);
		if (parsed.data === reminderTime) return;
		save.mutate(parsed.data, {
			onSuccess: () => toast("success", "Horário salvo", parsed.data),
			onError: onError("Não foi possível salvar o horário"),
		});
	};

	return (
		<View className="gap-4 border-t border-border pt-6">
			<Text
				accessibilityRole="header"
				className="text-lg font-bold text-foreground"
			>
				Lembretes
			</Text>

			<Pressable
				accessibilityRole="switch"
				accessibilityLabel="Lembrete diário"
				accessibilityHint="Avisa quando ainda há hábitos pendentes no dia"
				accessibilityState={{ checked: enabled, disabled: busy }}
				disabled={busy}
				onPress={() => toggle(!enabled)}
				className="min-h-touch flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
			>
				<MaterialCommunityIcons
					name="bell-outline"
					size={22}
					color={colors.muted}
				/>
				<View className="flex-1">
					<Text className="font-semibold text-foreground">Lembrete diário</Text>
					<Text className="text-sm text-muted">
						Avisa quando ainda há hábitos pendentes no dia.
					</Text>
				</View>
				<Switch
					value={enabled}
					disabled={busy}
					onValueChange={toggle}
					importantForAccessibility="no-hide-descendants"
					trackColor={{ false: colors.border, true: colors.violet[600] }}
					thumbColor={colors.foreground}
				/>
			</Pressable>

			{status ? (
				<View className="flex-row gap-2">
					<MaterialCommunityIcons
						name="information-outline"
						size={18}
						color={colors.muted}
					/>
					<Text
						accessibilityLiveRegion="polite"
						className="flex-1 text-sm text-muted"
					>
						{status}
					</Text>
				</View>
			) : null}
			{state === "denied" ? (
				<Button
					variant="secondary"
					icon="cog-outline"
					label="Abrir configurações"
					onPress={() => void Linking.openSettings()}
				/>
			) : null}

			<View className="gap-2">
				<TextField
					label="Horário (HH:MM)"
					value={time}
					onChangeText={(text) => {
						setTime(text);
						setTimeError(undefined);
					}}
					keyboardType="numbers-and-punctuation"
					maxLength={5}
					placeholder="20:00"
					returnKeyType="done"
					onSubmitEditing={saveTime}
					onBlur={enabled ? saveTime : undefined}
					hint="No seu fuso horário. Pode chegar até 15 minutos depois. Sem hábitos pendentes, nenhum lembrete é enviado."
					error={timeError}
				/>
			</View>

			<Button
				variant="secondary"
				icon="bell-ring-outline"
				label="Enviar notificação de teste"
				pending={sendTest.isPending}
				onPress={() =>
					sendTest.mutate(undefined, {
						onSuccess: ({ sent, failed }) =>
							sent > 0
								? toast(
										"success",
										"Notificação de teste enviada",
										failed > 0
											? `${sent} aparelho(s) receberam; ${failed} falharam.`
											: `Enviada para ${sent} aparelho(s).`
									)
								: toast(
										"error",
										"Nenhum aparelho recebeu o teste",
										"Ative o lembrete para registrar este aparelho."
									),
						onError: (error) => {
							if (isUnauthorized(error)) return;
							toast(
								"error",
								toDataError(error).kind === "rate_limited"
									? "Aguarde um minuto"
									: "Não foi possível enviar o teste",
								toDataError(error).kind === "rate_limited"
									? "Só é possível enviar um teste por minuto."
									: errorMessage(error)
							);
						},
					})
				}
			/>
		</View>
	);
}
