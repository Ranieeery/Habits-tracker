import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReminderTime } from "@habits/contracts";
import { MORNING_DIGEST_TIME } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { type ComponentProps, useRef, useState } from "react";
import { Linking, Pressable, Switch, Text, View } from "react-native";
import { errorMessage, isUnauthorized, toDataError } from "@/data/errors.ts";
import {
	DEFAULT_REMINDER_TIME,
	type EnableOutcome,
	useEnableDigest,
	usePushPermission,
	useEnableReminders,
	useSaveNotificationFlags,
	useSaveReminderTime,
	useSendTestPush,
} from "@/data/push-hooks.ts";
import type { PushPermission } from "@/data/push-logic.ts";
import { useLoadedSettings } from "@/data/today.ts";
import { Button } from "@/ui/button.tsx";
import { QuarterTimePicker } from "@/ui/time-picker.tsx";
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

/** A settings row: icon, title, description and a switch (44 dp+). */
function SwitchRow({
	icon,
	title,
	description,
	value,
	disabled,
	onChange,
}: {
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
	title: string;
	description: string;
	value: boolean;
	disabled: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={title}
			accessibilityHint={description}
			accessibilityState={{ checked: value, disabled }}
			disabled={disabled}
			onPress={() => onChange(!value)}
			className="min-h-touch flex-row items-center gap-3 rounded-xl border border-night-border bg-night-surface px-4 py-3"
		>
			<MaterialCommunityIcons name={icon} size={22} color={nightColors.muted} />
			<View className="flex-1">
				<Text className="font-semibold text-night-foreground">{title}</Text>
				<Text className="text-sm text-night-muted">{description}</Text>
			</View>
			<Switch
				value={value}
				disabled={disabled}
				onValueChange={onChange}
				importantForAccessibility="no-hide-descendants"
				trackColor={{
					false: nightColors.border.DEFAULT,
					true: nightColors.accent.DEFAULT,
				}}
				thumbColor={nightColors.foreground}
			/>
		</Pressable>
	);
}

/**
 * Notifications (account-wide): the morning digest at the fixed 09:00, the
 * daily reminder on/off and time in 15-minute steps, hiding habit names, plus
 * this device's status.
 */
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
	const lastRequested = useRef<string | null>(null);
	const flags = useSaveNotificationFlags();
	const enableDigest = useEnableDigest();

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

	const toggleDigest = (on: boolean) => {
		if (!on) {
			flags.mutate(
				{ morning_digest_enabled: false },
				{ onError: onError("Não foi possível salvar") }
			);
			return;
		}
		enableDigest.mutate(undefined, {
			onSuccess: setOutcome,
			onError: onError("Não foi possível ativar o resumo"),
		});
	};

	const saveTime = (value: string) => {
		setTime(value);
		const parsed = ReminderTime.safeParse(value);
		if (!parsed.success) {
			setTimeError("Escolha um horário em passos de 15 minutos.");
			return;
		}
		if (!enabled) return;
		setTimeError(undefined);
		// "Done" on the keyboard and the blur that follows both land here:
		// save each value once.
		if (parsed.data === reminderTime || parsed.data === lastRequested.current) {
			return;
		}
		lastRequested.current = parsed.data;
		save.mutate(parsed.data, {
			onSuccess: () => toast("success", "Horário salvo", parsed.data),
			onError: (error) => {
				lastRequested.current = null;
				onError("Não foi possível salvar o horário")(error);
			},
		});
	};

	return (
		<View className="gap-4 border-t border-night-border pt-6">
			<Text
				accessibilityRole="header"
				className="text-lg font-bold text-night-foreground"
			>
				Notificações
			</Text>

			<SwitchRow
				icon="weather-sunset-up"
				title={`Resumo da manhã (${MORNING_DIGEST_TIME})`}
				description="Horário fixo: o que acontece hoje e as datas únicas de amanhã."
				value={settings.morning_digest_enabled}
				disabled={flags.isPending || enableDigest.isPending}
				onChange={toggleDigest}
			/>

			<SwitchRow
				icon="bell-outline"
				title="Lembrete diário"
				description="Avisa quando ainda há hábitos pendentes no dia."
				value={enabled}
				disabled={busy}
				onChange={toggle}
			/>

			{status ? (
				<View className="flex-row gap-2">
					<MaterialCommunityIcons
						name="information-outline"
						size={18}
						color={nightColors.muted}
					/>
					<Text
						accessibilityLiveRegion="polite"
						className="flex-1 text-sm text-night-muted"
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
				<QuarterTimePicker
					label="Horário do lembrete"
					value={time}
					disabled={busy}
					onChange={saveTime}
				/>
				<Text className="text-sm text-night-muted">
					No seu fuso horário, em passos de 15 minutos. Sem hábitos pendentes,
					nenhum lembrete é enviado.
				</Text>
				{timeError ? (
					<Text className="text-sm text-night-danger">{timeError}</Text>
				) : null}
			</View>

			<SwitchRow
				icon="eye-off-outline"
				title="Mostrar nomes nas notificações"
				description="Desligado, o resumo diz só “Você tem compromissos hoje”, também na tela bloqueada."
				value={settings.show_titles_in_notifications}
				disabled={flags.isPending}
				onChange={(on) =>
					flags.mutate(
						{ show_titles_in_notifications: on },
						{ onError: onError("Não foi possível salvar") }
					)
				}
			/>

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
