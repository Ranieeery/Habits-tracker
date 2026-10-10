import { Email, PASSWORD_MAX_LENGTH } from "@habits/contracts";
import { useRef, useState } from "react";
import { Text, type TextInput, View } from "react-native";
import { AuthError, type AuthErrorReason } from "@/data/auth.ts";
import { useSignIn } from "@/data/hooks.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { FieldError, TextField } from "@/ui/text-field.tsx";

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
export function LoginScreen() {
	useHideSplashWhen(true);
	const signIn = useSignIn();
	const passwordRef = useRef<TextInput>(null);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string>();

	const submit = () => {
		if (!Email.safeParse(email.trim()).success) {
			setError("Digite um e-mail válido.");
			return;
		}
		if (!password) {
			setError("Digite sua senha.");
			return;
		}
		setError(undefined);
		signIn.mutate(
			{ email: email.trim(), password },
			{
				onError: (cause) =>
					setError(
						REASONS[cause instanceof AuthError ? cause.reason : "unknown"]
					),
			}
		);
	};

	return (
		<Screen edges={["top", "bottom"]}>
			<View className="gap-2 pt-16">
				<Text className="text-sm font-bold tracking-widest text-violet-400 uppercase">
					Habits
				</Text>
				<Text
					accessibilityRole="header"
					className="text-3xl font-extrabold text-foreground"
				>
					Entrar
				</Text>
			</View>

			<View className="gap-5">
				<TextField
					label="E-mail"
					value={email}
					onChangeText={setEmail}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="email"
					keyboardType="email-address"
					textContentType="emailAddress"
					returnKeyType="next"
					submitBehavior="submit"
					onSubmitEditing={() => passwordRef.current?.focus()}
				/>
				<View className="gap-2">
					<TextField
						ref={passwordRef}
						label="Senha"
						value={password}
						onChangeText={setPassword}
						secureTextEntry={!showPassword}
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="current-password"
						textContentType="password"
						maxLength={PASSWORD_MAX_LENGTH}
						returnKeyType="go"
						onSubmitEditing={submit}
					/>
					<Button
						variant="ghost"
						icon={showPassword ? "eye-off-outline" : "eye-outline"}
						label={showPassword ? "Ocultar senha" : "Mostrar senha"}
						onPress={() => setShowPassword((value) => !value)}
						className="self-start px-2"
					/>
				</View>
				<FieldError>{error}</FieldError>
				<Button
					label={signIn.isPending ? "Entrando…" : "Entrar"}
					pending={signIn.isPending}
					onPress={submit}
				/>
			</View>
		</Screen>
	);
}
