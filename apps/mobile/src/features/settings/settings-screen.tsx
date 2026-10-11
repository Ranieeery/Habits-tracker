import { TimeZone } from "@habits/contracts";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useRouter } from "expo-router";
import {
	useSession,
	useSignOut,
	useSyncAndCountUnsynced,
	useSyncStatus,
	useUpdateTimeZone,
} from "@/data/hooks.ts";
import { useServices } from "@/data/services.ts";
import { useLoadedSettings, useToday } from "@/data/today.ts";
import { formatLongDate } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { TextField } from "@/ui/text-field.tsx";
import { useToast } from "@/ui/toast.tsx";
import { SyncIndicator } from "@/features/sync/sync-indicator.tsx";
import { RemindersSection } from "./reminders-section.tsx";
import { TimezoneBanner } from "./timezone-banner.tsx";

export function SettingsScreen() {
	useHideSplashWhen(true);
	const router = useRouter();
	const session = useSession();
	const signOut = useSignOut();
	const syncForSignOut = useSyncAndCountUnsynced();
	const status = useSyncStatus();
	const { timezone } = useLoadedSettings();
	const user = session.data?.status === "signed_in" ? session.data.user : null;

	const warnUnsynced = (count: number, canSync: boolean) =>
		Alert.alert(
			"Alterações não sincronizadas",
			`${count === 1 ? "Há 1 alteração que ainda não chegou" : `Há ${count} alterações que ainda não chegaram`} ao servidor. Sair apaga deste aparelho.`,
			[
				{ text: "Cancelar", style: "cancel" },
				...(canSync
					? [
							{
								text: "Sincronizar e sair",
								onPress: () =>
									syncForSignOut.mutate(undefined, {
										// Sign out only if everything went through;
										// otherwise warn again with what is left.
										onSuccess: (left) =>
											left === 0 ? signOut.mutate() : warnUnsynced(left, false),
									}),
							},
						]
					: []),
				{
					text: "Sair mesmo assim",
					style: "destructive" as const,
					onPress: () => signOut.mutate(),
				},
			]
		);

	const confirmSignOut = () => {
		const unsynced = status.pending + status.failed;
		if (unsynced > 0) {
			warnUnsynced(unsynced, true);
			return;
		}
		Alert.alert("Sair da conta?", "Você vai precisar entrar de novo.", [
			{ text: "Cancelar", style: "cancel" },
			{
				text: "Sair",
				style: "destructive",
				onPress: () => signOut.mutate(),
			},
		]);
	};

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
			<RemindersSection />

			<View className="gap-3 border-t border-border pt-6">
				<Text
					accessibilityRole="header"
					className="text-lg font-bold text-foreground"
				>
					Sincronização
				</Text>
				<Text className="text-sm text-muted">
					Seus hábitos ficam salvos neste aparelho e funcionam sem internet.
				</Text>
				<SyncIndicator />
				<Button
					variant="secondary"
					icon="cloud-sync-outline"
					label="Detalhes e falhas"
					onPress={() => router.push("/sync")}
				/>
			</View>

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
					pending={signOut.isPending || syncForSignOut.isPending}
					onPress={confirmSignOut}
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
