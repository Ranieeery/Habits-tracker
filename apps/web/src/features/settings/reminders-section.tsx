import { ReminderTime } from "@habits/contracts";
import { MORNING_DIGEST_TIME } from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, EyeOffIcon, InfoIcon, SunriseIcon } from "lucide-react";
import { useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Select } from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type { PushSupport } from "@/lib/push.ts";
import { settingsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import {
	DEFAULT_REMINDER_TIME,
	type EnableOutcome,
	useEnableDigest,
	useEnableReminders,
	useSaveNotificationFlags,
	useSaveReminderTime,
	useSendTestPush,
} from "./use-reminders.ts";

const DEVICE_STATUS: Record<PushSupport | EnableOutcome, string | null> = {
	granted: "Este navegador recebe notificações.",
	enabled: "Este navegador recebe notificações.",
	prompt: null,
	denied:
		"Notificações bloqueadas neste navegador. Para recebê-las aqui, libere nas configurações do site (ícone ao lado do endereço). Os lembretes continuam valendo para seus outros aparelhos.",
	unsupported:
		"Este navegador não recebe notificações (ou o app está em modo de desenvolvimento). Os lembretes continuam valendo para seus outros aparelhos.",
	"ios-needs-install":
		"No iPhone e no iPad, as notificações só funcionam com o app instalado: toque em Compartilhar e depois em Adicionar à Tela de Início, e abra o Habits por lá.",
};

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
/** The reminder cron runs every 15 minutes: times go in 15-minute steps. */
const MINUTES = ["00", "15", "30", "45"];

/**
 * Notifications (account-wide): the morning digest at the fixed 09:00, the
 * daily reminder on/off and time in 15-minute steps, hiding habit names, plus
 * this device's status.
 */
export function RemindersSection() {
	const { api, push } = useServices();
	const settings = useQuery(settingsQuery(api));
	const reminderTime = settings.data?.reminder_time ?? null;
	const enabled = reminderTime !== null;
	const [support, setSupport] = useState<PushSupport | EnableOutcome>(() =>
		push.support()
	);
	const enable = useEnableReminders();
	// Turning off and changing the time only save the setting (devices stay).
	const save = useSaveReminderTime();
	const sendTest = useSendTestPush();
	const [time, setTime] = useState<string>(
		reminderTime ?? DEFAULT_REMINDER_TIME
	);
	const [timeError, setTimeError] = useState<string>();
	const flags = useSaveNotificationFlags();
	const enableDigest = useEnableDigest();
	const digestOn = settings.data?.morning_digest_enabled ?? true;
	const titlesOn = settings.data?.show_titles_in_notifications ?? true;
	const ids = {
		toggle: useId(),
		time: useId(),
		hint: useId(),
		status: useId(),
		error: useId(),
		digest: useId(),
		titles: useId(),
	};
	const busy = enable.isPending || save.isPending;
	const [hour = "20", minute = "00"] = time.split(":");
	const status = DEVICE_STATUS[support];

	const toggle = (on: boolean) => {
		if (!on) {
			save.mutate(null);
			return;
		}
		const parsed = ReminderTime.safeParse(time);
		enable.mutate(parsed.success ? parsed.data : DEFAULT_REMINDER_TIME, {
			onSuccess: (outcome) => setSupport(outcome),
		});
	};

	const saveTime = (value: string) => {
		setTime(value);
		const parsed = ReminderTime.safeParse(value);
		if (!parsed.success) {
			setTimeError("Escolha um horário em passos de 15 minutos.");
			return;
		}
		setTimeError(undefined);
		if (enabled && parsed.data !== reminderTime) save.mutate(parsed.data);
	};

	const toggleDigest = (on: boolean) => {
		if (!on) {
			flags.mutate({ morning_digest_enabled: false });
			return;
		}
		enableDigest.mutate(undefined, {
			onSuccess: (outcome) => setSupport(outcome),
		});
	};

	return (
		<section
			aria-labelledby={`${ids.toggle}-title`}
			className="flex flex-col gap-4 border-t border-border pt-6"
		>
			<h2 id={`${ids.toggle}-title`} className="text-lg font-bold">
				Notificações
			</h2>

			<label
				htmlFor={ids.digest}
				className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3"
			>
				<span className="flex items-center gap-3">
					<SunriseIcon className="size-5 text-muted" aria-hidden="true" />
					<span className="flex flex-col">
						<span className="font-semibold">
							Resumo da manhã ({MORNING_DIGEST_TIME})
						</span>
						<span className="text-sm text-muted">
							Horário fixo: o que acontece hoje e as datas únicas de amanhã.
						</span>
					</span>
				</span>
				<Switch
					id={ids.digest}
					checked={digestOn}
					disabled={
						flags.isPending || enableDigest.isPending || settings.isPending
					}
					onCheckedChange={toggleDigest}
				/>
			</label>

			<label
				htmlFor={ids.toggle}
				className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3"
			>
				<span className="flex items-center gap-3">
					<BellIcon className="size-5 text-muted" aria-hidden="true" />
					<span className="flex flex-col">
						<span className="font-semibold">Lembrete diário</span>
						<span className="text-sm text-muted">
							Avisa quando ainda há hábitos pendentes no dia.
						</span>
					</span>
				</span>
				<Switch
					id={ids.toggle}
					checked={enabled}
					disabled={busy || settings.isPending}
					aria-describedby={status ? ids.status : undefined}
					onCheckedChange={toggle}
				/>
			</label>

			{status && (
				<p
					id={ids.status}
					role="status"
					className="flex gap-2 text-sm text-muted"
				>
					<InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					{status}
				</p>
			)}

			<fieldset className="flex flex-col gap-2">
				<legend id={ids.time} className="text-sm font-semibold">
					Horário do lembrete
				</legend>
				<div className="flex items-center gap-2">
					<Select
						aria-label="Hora"
						value={hour}
						aria-invalid={timeError ? true : undefined}
						aria-describedby={timeError ? `${ids.hint} ${ids.error}` : ids.hint}
						onChange={(event) => saveTime(`${event.target.value}:${minute}`)}
					>
						{HOURS.map((h) => (
							<option key={h} value={h}>
								{h}
							</option>
						))}
					</Select>
					<span aria-hidden="true">:</span>
					<Select
						aria-label="Minutos"
						value={MINUTES.includes(minute) ? minute : "00"}
						aria-describedby={ids.hint}
						onChange={(event) => saveTime(`${hour}:${event.target.value}`)}
					>
						{MINUTES.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</Select>
				</div>
				<p id={ids.hint} className="text-sm text-muted">
					No seu fuso horário, em passos de 15 minutos. Sem hábitos pendentes,
					nenhum lembrete é enviado.
				</p>
				<FieldError id={ids.error}>{timeError}</FieldError>
			</fieldset>

			<label
				htmlFor={ids.titles}
				className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3"
			>
				<span className="flex items-center gap-3">
					<EyeOffIcon className="size-5 text-muted" aria-hidden="true" />
					<span className="flex flex-col">
						<span className="font-semibold">
							Mostrar nomes nas notificações
						</span>
						<span className="text-sm text-muted">
							Desligado, o resumo diz só &quot;Você tem compromissos hoje&quot;,
							também na tela bloqueada.
						</span>
					</span>
				</span>
				<Switch
					id={ids.titles}
					checked={titlesOn}
					disabled={flags.isPending || settings.isPending}
					onCheckedChange={(on) =>
						flags.mutate({ show_titles_in_notifications: on })
					}
				/>
			</label>

			<Button
				variant="secondary"
				className="self-start"
				disabled={sendTest.isPending}
				onClick={() => sendTest.mutate()}
			>
				{sendTest.isPending ? "Enviando…" : "Enviar notificação de teste"}
			</Button>
		</section>
	);
}
