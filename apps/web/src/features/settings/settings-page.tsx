import { TimeZone } from "@habits/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { queryKeys, sessionQuery } from "@/lib/queries.ts";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";
import { useUpdateTimeZone } from "./use-update-time-zone.ts";

function supportedTimeZones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return [];
	}
}

export function SettingsPage() {
	const { auth, deviceTimeZone } = useServices();
	const session = useQuery(sessionQuery(auth));
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [signingOut, setSigningOut] = useState(false);
	const savedTimeZone = useUserTimeZone();

	const signOut = async () => {
		setSigningOut(true);
		try {
			await auth.signOut();
		} catch {
			toast.error("Não foi possível sair", {
				description: "Verifique sua conexão e tente de novo.",
			});
			setSigningOut(false);
			return;
		}
		queryClient.clear();
		queryClient.setQueryData(queryKeys.session, null);
		await navigate({ to: "/login", search: {}, replace: true });
	};

	return (
		<section aria-labelledby="settings-title" className="flex flex-col gap-8">
			<h1 id="settings-title" className="text-3xl font-extrabold">
				Ajustes
			</h1>

			<TimeZoneForm
				key={savedTimeZone}
				saved={savedTimeZone}
				deviceTimeZone={deviceTimeZone()}
			/>

			<div className="flex flex-col gap-3 border-t border-border pt-6">
				<h2 className="text-lg font-bold">Conta</h2>
				{session.data && (
					<p className="text-sm text-muted">
						Conectado como{" "}
						<span className="text-foreground">{session.data.email}</span>
					</p>
				)}
				<Button
					variant="danger"
					className="self-start"
					disabled={signingOut}
					onClick={signOut}
				>
					<LogOutIcon aria-hidden="true" />
					{signingOut ? "Saindo…" : "Sair"}
				</Button>
			</div>

			<p className="text-sm text-muted">
				Lembretes por notificação chegam em uma próxima versão.
			</p>
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
			<Label htmlFor={ids.input} className="text-lg font-bold">
				Fuso horário
			</Label>
			<p id={ids.hint} className="text-sm text-muted">
				Define quando cada dia começa e termina para os seus hábitos.
			</p>
			<Input
				id={ids.input}
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
				{deviceTimeZone !== value && (
					<Button variant="secondary" onClick={() => setValue(deviceTimeZone)}>
						Usar o do dispositivo ({deviceTimeZone})
					</Button>
				)}
			</div>
		</form>
	);
}
