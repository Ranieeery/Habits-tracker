import { Email } from "@habits/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { AuthError, type AuthErrorReason } from "@/lib/auth.ts";
import { queryKeys } from "@/lib/queries.ts";
import { safeRedirect } from "@/lib/redirect.ts";
import { useServices } from "@/lib/services.ts";

const REASONS: Record<AuthErrorReason, string> = {
	invalid_credentials: "E-mail ou senha incorretos.",
	rate_limited: "Muitas tentativas. Aguarde um minuto e tente de novo.",
	network: "Sem conexão com o servidor. Verifique sua internet.",
	unknown: "Não foi possível entrar agora. Tente de novo.",
};

/**
 * Sign-in only: the owner account is created once after deploy (signup is
 * closed afterwards), and the API exposes no "owner exists" check.
 */
export function LoginPage({ redirect }: { redirect?: string }) {
	const { auth } = useServices();
	const queryClient = useQueryClient();
	const router = useRouter();
	const ids = { email: useId(), password: useId(), error: useId() };
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!Email.safeParse(email.trim()).success) {
			setError("Digite um e-mail válido.");
			return;
		}
		if (!password) {
			setError("Digite sua senha.");
			return;
		}
		setError(undefined);
		setPending(true);
		try {
			await auth.signIn({ email: email.trim(), password });
			const user = await auth.getSession();
			queryClient.setQueryData(queryKeys.session, user);
			router.history.push(safeRedirect(redirect));
		} catch (cause) {
			setError(REASONS[cause instanceof AuthError ? cause.reason : "unknown"]);
			setPending(false);
		}
	};

	return (
		<main className="flex min-h-dvh items-center justify-center px-4 py-10">
			<div className="flex w-full max-w-sm flex-col gap-8">
				<header className="flex flex-col gap-2">
					<p className="text-sm font-bold tracking-widest text-violet-400 uppercase">
						Habits
					</p>
					<h1 className="text-3xl font-extrabold">Entrar</h1>
				</header>

				<form
					noValidate
					onSubmit={handleSubmit}
					aria-describedby={error ? ids.error : undefined}
					className="flex flex-col gap-5"
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor={ids.email}>E-mail</Label>
						<Input
							id={ids.email}
							type="email"
							autoComplete="email"
							inputMode="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							aria-invalid={error ? true : undefined}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor={ids.password}>Senha</Label>
						<Input
							id={ids.password}
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							aria-invalid={error ? true : undefined}
						/>
					</div>
					<FieldError id={ids.error}>{error}</FieldError>
					<Button type="submit" disabled={pending}>
						{pending ? "Entrando…" : "Entrar"}
					</Button>
				</form>
			</div>
		</main>
	);
}
