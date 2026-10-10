import { ReminderTime } from "@habits/contracts";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, InfoIcon } from "lucide-react";
import { useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type { PushSupport } from "@/lib/push.ts";
import { settingsQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import {
	DEFAULT_REMINDER_TIME,
	type EnableOutcome,
	useEnableReminders,
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

/** Daily reminder on/off and time (account-wide), plus this device's status. */
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
	const ids = {
		toggle: useId(),
		time: useId(),
		hint: useId(),
		status: useId(),
		error: useId(),
	};
	const busy = enable.isPending || save.isPending;
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
		const parsed = ReminderTime.safeParse(value);
		if (!parsed.success) {
			setTimeError("Use o formato HH:MM, por exemplo 20:00.");
			return;
		}
		setTimeError(undefined);
		if (enabled && parsed.data !== reminderTime) save.mutate(parsed.data);
	};

	return (
		<section
			aria-labelledby={`${ids.toggle}-title`}
			className="flex flex-col gap-4 border-t border-border pt-6"
		>
			<h2 id={`${ids.toggle}-title`} className="text-lg font-bold">
				Lembretes
			</h2>

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

			<div className="flex flex-col gap-2">
				<Label htmlFor={ids.time}>Horário</Label>
				<Input
					id={ids.time}
					type="time"
					step={60}
					value={time}
					className="w-40"
					aria-invalid={timeError ? true : undefined}
					aria-describedby={timeError ? `${ids.hint} ${ids.error}` : ids.hint}
					onChange={(event) => setTime(event.target.value)}
					onBlur={(event) => saveTime(event.target.value)}
				/>
				<p id={ids.hint} className="text-sm text-muted">
					No seu fuso horário. Pode chegar até 15 minutos depois. Sem hábitos
					pendentes, nenhum lembrete é enviado.
				</p>
				<FieldError id={ids.error}>{timeError}</FieldError>
			</div>

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
