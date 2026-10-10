import { TimeZone } from "@habits/contracts";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useSession, useSignOut, useUpdateTimeZone } from "@/data/hooks.ts";
import { useServices } from "@/data/services.ts";
import { useLoadedSettings, useToday } from "@/data/today.ts";
import { formatLongDate } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { TextField } from "@/ui/text-field.tsx";
import { useToast } from "@/ui/toast.tsx";
import { TimezoneBanner } from "./timezone-banner.tsx";

export function SettingsScreen() {
	useHideSplashWhen(true);
	const session = useSession();
	const signOut = useSignOut();
	const { timezone } = useLoadedSettings();
	const user = session.data?.status === "signed_in" ? session.data.user : null;

	return (
		<Screen>
			<Text
				accessibilityRole="header"
				className="text-3xl font-extrabold text-foreground"
			>
				Ajustes
			</Text>

			<TimezoneBanner />
			{/* Remounts with the saved value when the banner changes it. */}
			<TimeZoneSection key={timezone} />

			<View className="gap-3 border-t border-border pt-6">
				<Text
					accessibilityRole="header"
					className="text-lg font-bold text-foreground"
				>
					Conta
				</Text>
				{user ? (
					<Text className="text-muted">
						Conectado como{" "}
						<Text className="font-semibold text-foreground">{user.email}</Text>
					</Text>
				) : null}
				<Button
					variant="danger"
					icon="logout"
					label="Sair"
					pending={signOut.isPending}
					onPress={() =>
						Alert.alert("Sair da conta?", "Você vai precisar entrar de novo.", [
							{ text: "Cancelar", style: "cancel" },
							{
								text: "Sair",
								style: "destructive",
								onPress: () => signOut.mutate(),
							},
						])
					}
				/>
			</View>
		</Screen>
	);
}

/** The IANA time zone that defines the user's days (validated before saving). */
function TimeZoneSection() {
	const { deviceTimeZone } = useServices();
	const settings = useLoadedSettings();
	const today = useToday();
	const update = useUpdateTimeZone();
	const toast = useToast();
	const [value, setValue] = useState(settings.timezone);
	const [error, setError] = useState<string>();
	const device = deviceTimeZone();

	const save = (timezone: string) => {
		const parsed = TimeZone.safeParse(timezone.trim());
		if (!parsed.success) {
			setError("Fuso inválido. Use um nome IANA, como America/Sao_Paulo.");
			return;
		}
		setError(undefined);
		update.mutate(parsed.data, {
			onSuccess: (saved) => {
				setValue(saved.timezone);
				toast("success", "Fuso horário atualizado", saved.timezone);
			},
			onError: (cause) => {
				if (!isUnauthorized(cause)) {
					toast("error", "Não foi possível salvar o fuso", errorMessage(cause));
				}
			},
		});
	};

	return (
		<View className="gap-4">
			<Text
				accessibilityRole="header"
				className="text-lg font-bold text-foreground"
			>
				Fuso horário
			</Text>
			<Text className="text-sm text-muted">
				Seus dias são contados neste fuso. Hoje é{" "}
				<Text className="font-semibold text-foreground">
					{formatLongDate(today)}
				</Text>
				.
			</Text>
			<TextField
				label="Fuso (IANA)"
				value={value}
				onChangeText={(text) => {
					setValue(text);
					setError(undefined);
				}}
				autoCapitalize="none"
				autoCorrect={false}
				placeholder="America/Sao_Paulo"
				returnKeyType="done"
				onSubmitEditing={() => save(value)}
				error={error}
			/>
			<View className="gap-2">
				<Button
					label="Salvar fuso"
					pending={update.isPending}
					disabled={value.trim() === settings.timezone}
					onPress={() => save(value)}
				/>
				{device && device !== settings.timezone ? (
					<Button
						variant="secondary"
						icon="crosshairs-gps"
						label={`Usar o do aparelho (${device})`}
						disabled={update.isPending}
						onPress={() => {
							setValue(device);
							save(device);
						}}
					/>
				) : null}
			</View>
		</View>
	);
}
