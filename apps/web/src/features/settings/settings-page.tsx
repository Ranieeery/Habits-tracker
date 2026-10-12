import { TimeZone } from "@habits/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CrosshairIcon, LogOutIcon } from "lucide-react";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { formatLongDate } from "@/lib/format.ts";
import { queryKeys, sessionQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useToday, useUserTimeZone } from "@/lib/use-today.ts";
import { RemindersSection } from "./reminders-section.tsx";
import { unregisterThisBrowser } from "./use-reminders.ts";
import { useUpdateTimeZone } from "./use-update-time-zone.ts";

function supportedTimeZones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return [];
	}
}

export function SettingsPage() {
	const { deviceTimeZone } = useServices();
	const savedTimeZone = useUserTimeZone();

	return (
		<section
			aria-labelledby="settings-title"
			className="mx-auto flex w-full max-w-2xl flex-col gap-8"
		>
			<h1
				id="settings-title"
				className="font-display text-4xl font-bold tracking-tight"
			>
				Ajustes
			</h1>

			<TimeZoneForm
				key={savedTimeZone}
				saved={savedTimeZone}
				deviceTimeZone={deviceTimeZone()}
			/>

			<RemindersSection />

			<AccountSection />
		</section>
	);
}

function TimeZoneForm({
	saved,
	deviceTimeZone,
}: {
	saved: string;
	deviceTimeZone: string;
}) {
	const [value, setValue] = useState(saved);
	const [error, setError] = useState<string>();
	const update = useUpdateTimeZone();
	const today = useToday();
	const zones = useMemo(() => supportedTimeZones(), []);
	const ids = { input: useId(), list: useId(), hint: useId(), error: useId() };

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = TimeZone.safeParse(value.trim());
		if (!parsed.success) {
			setError("Fuso inválido. Use um nome IANA, como America/Sao_Paulo.");
			return;
		}
		setError(undefined);
		if (parsed.data !== saved) update.mutate(parsed.data);
	};

	return (
		<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
			<Label
				htmlFor={ids.input}
				className="font-display text-xl leading-tight font-bold"
			>
				Fuso horário
			</Label>
			<p id={ids.hint} className="text-sm text-night-muted">
				Define quando cada dia começa e termina para os seus hábitos. Hoje é{" "}
				<span className="font-semibold text-night-foreground">
					{formatLongDate(today)}
				</span>
				.
			</p>
			<Input
				id={ids.input}
				name="timezone"
				list={ids.list}
				value={value}
				spellCheck={false}
				autoCapitalize="off"
				autoComplete="off"
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? `${ids.hint} ${ids.error}` : ids.hint}
				onChange={(event) => setValue(event.target.value)}
			/>
			<datalist id={ids.list}>
				{zones.map((zone) => (
					<option key={zone} value={zone} />
				))}
			</datalist>
			<FieldError id={ids.error}>{error}</FieldError>
			<div className="flex flex-wrap gap-2">
				<Button type="submit" disabled={update.isPending || value === saved}>
					{update.isPending ? "Salvando…" : "Salvar fuso"}
				</Button>
				{/* Like the mobile: one tap saves the device's zone. */}
				{deviceTimeZone !== saved && (
					<Button
						variant="secondary"
						disabled={update.isPending}
						onClick={() => {
							setValue(deviceTimeZone);
							setError(undefined);
							update.mutate(deviceTimeZone);
						}}
					>
						<CrosshairIcon aria-hidden="true" />
						Usar o do dispositivo ({deviceTimeZone})
					</Button>
				)}
			</div>
		</form>
	);
}

/** The signed-in account and "Sair", which asks first (like the mobile). */
function AccountSection() {
	const services = useServices();
	const { auth } = services;
	const session = useQuery(sessionQuery(auth));
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [confirming, setConfirming] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const titleId = useId();

	const signOut = async () => {
		setSigningOut(true);
		// While the session still exists: this browser stops receiving pushes.
		await unregisterThisBrowser(services);
		try {
			await auth.signOut();
		} catch {
			toast.error("Não foi possível sair", {
				description: "Verifique sua conexão e tente de novo.",
			});
			setSigningOut(false);
			setConfirming(false);
			return;
		}
		queryClient.clear();
		queryClient.setQueryData(queryKeys.session, null);
		await navigate({ to: "/login", search: {}, replace: true });
	};

	return (
		<section
			aria-labelledby={titleId}
			className="flex flex-col gap-3 border-t border-night-border pt-6"
		>
			<h2 id={titleId} className="font-display text-xl font-bold">
				Conta
			</h2>
			{session.data && (
				<p className="text-sm text-night-muted">
					Conectado como{" "}
					<span className="font-semibold break-all text-night-foreground">
						{session.data.email}
					</span>
				</p>
			)}
			<Dialog
				open={confirming}
				onOpenChange={(open) => !signingOut && setConfirming(open)}
			>
				<DialogTrigger asChild>
					<Button variant="danger" className="self-start">
						<LogOutIcon aria-hidden="true" />
						Sair
					</Button>
				</DialogTrigger>
				<DialogContent
					role="alertdialog"
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						cancelRef.current?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>Sair da conta?</DialogTitle>
						<DialogDescription>
							Você vai precisar entrar de novo.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							ref={cancelRef}
							variant="ghost"
							disabled={signingOut}
							onClick={() => setConfirming(false)}
						>
							Cancelar
						</Button>
						<Button
							variant="danger"
							disabled={signingOut}
							onClick={() => void signOut()}
						>
							<LogOutIcon aria-hidden="true" />
							{signingOut ? "Saindo…" : "Sair"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</section>
	);
}
