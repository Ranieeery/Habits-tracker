import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSyncNow, useSyncStatus } from "@/data/hooks.ts";
import { useSyncTriggers } from "@/data/sync/triggers.ts";
import { Button } from "@/ui/button.tsx";
import { ProgressBar } from "@/ui/progress-bar.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";

/**
 * Starts syncing for the signed-in user and, while the device has never
 * finished a full pull (first sign-in, or after a reset), shows its progress
 * instead of the app: screens read only the device database.
 */
export function InitialSyncGate({ children }: { children: ReactNode }) {
	useSyncTriggers();
	const status = useSyncStatus();
	// Its own screen replaces the splash; otherwise the app's screens hide it.
	useHideSplashWhen(!status.initialSyncDone);

	if (status.initialSyncDone) return children;
	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
			<View className="flex-1 justify-center gap-6 px-6">
				<InitialSyncState />
			</View>
		</SafeAreaView>
	);
}

function InitialSyncState() {
	const status = useSyncStatus();
	const syncNow = useSyncNow();
	const retry = (
		<Button
			variant="secondary"
			icon="refresh"
			label="Tentar novamente"
			pending={syncNow.isPending}
			onPress={() => syncNow.mutate()}
		/>
	);

	if (status.state === "offline") {
		return (
			<Notice
				icon="wifi-off"
				text="Sem conexão. Seus dados serão baixados assim que você se conectar."
			>
				{retry}
			</Notice>
		);
	}
	if (status.state === "error") {
		return (
			<Notice
				icon="alert-circle-outline"
				text="Não foi possível baixar seus dados agora. Tentaremos de novo em instantes."
			>
				{retry}
			</Notice>
		);
	}

	const { received = 0, remaining = null } = status.progress ?? {};
	const total = remaining === null ? null : received + remaining;
	return (
		<View className="gap-4">
			<Text className="text-center text-lg font-bold text-foreground">
				Baixando seus dados…
			</Text>
			<ProgressBar
				ratio={total ? received / total : 0}
				label="Progresso do download"
				valueText={total ? `${received} de ${total}` : "Iniciando"}
			/>
			<Text className="text-center text-sm text-muted">
				{total ? `${received} de ${total} registros` : "Conectando ao servidor"}
			</Text>
		</View>
	);
}

function Notice({
	icon,
	text,
	children,
}: {
	icon: "wifi-off" | "alert-circle-outline";
	text: string;
	children: ReactNode;
}) {
	return (
		<View
			accessibilityRole="alert"
			className="items-center gap-4 rounded-xl border border-border bg-surface p-6"
		>
			<MaterialCommunityIcons name={icon} size={32} color={colors.muted} />
			<Text className="text-center text-base text-foreground">{text}</Text>
			{children}
		</View>
	);
}
