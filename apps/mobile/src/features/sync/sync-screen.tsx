import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { Alert, Text, View } from "react-native";
import {
	useDiscardFailures,
	useRetryFailures,
	useRunBackgroundSync,
	useSyncFailures,
	useSyncNow,
	useSyncStatus,
} from "@/data/hooks.ts";
import type { FailureView } from "@/data/sync/failures.ts";
import { isClockSkewed, syncLabel } from "@/lib/sync-label.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";

/** Sync state, "Sincronizar agora", and the changes the server refused. */
export function SyncScreen() {
	useHideSplashWhen(true);
	const status = useSyncStatus();
	const failures = useSyncFailures();
	const syncNow = useSyncNow();
	const { label } = syncLabel(status);

	return (
		<Screen>
			<View className="gap-2">
				<Text className="text-lg font-bold text-night-foreground">{label}</Text>
				<Text className="text-sm text-night-muted">
					Suas alterações ficam salvas neste aparelho e são enviadas quando
					houver conexão.
					{status.pending > 0
						? ` ${status.pending} ${status.pending === 1 ? "alteração aguarda" : "alterações aguardam"} envio.`
						: ""}
				</Text>
			</View>
			<Button
				icon="cloud-sync-outline"
				label="Sincronizar agora"
				pending={syncNow.isPending || status.state === "syncing"}
				onPress={() => syncNow.mutate()}
			/>
			{__DEV__ ? <RunBackgroundTask /> : null}

			{isClockSkewed(status.clockSkewMs) ? (
				<View
					accessibilityRole="alert"
					className="flex-row gap-3 rounded-xl border border-night-border bg-night-surface p-4"
				>
					<MaterialCommunityIcons
						name="clock-alert-outline"
						size={20}
						color={nightColors.danger.DEFAULT}
					/>
					<Text className="flex-1 text-sm text-night-foreground">
						O relógio do aparelho parece errado. Ajuste a data e a hora
						automáticas: hábitos marcados podem cair no dia errado.
					</Text>
				</View>
			) : null}

			<View className="gap-3 border-t border-night-border pt-6">
				<Text
					accessibilityRole="header"
					className="text-lg font-bold text-night-foreground"
				>
					Falhas
				</Text>
				<QueryState query={failures}>
					{(list) =>
						list.length === 0 ? (
							<EmptyState
								title="Nenhuma falha"
								description="Todas as alterações foram aceitas ou aguardam envio."
							/>
						) : (
							<View className="gap-3">
								<Text className="text-sm text-night-muted">
									O servidor recusou estas alterações. Elas não aparecem nos
									seus dados até você tentar de novo; descartar apaga de vez.
								</Text>
								{list.map((failure) => (
									<FailureRow key={failure.mutationId} failure={failure} />
								))}
							</View>
						)
					}
				</QueryState>
			</View>
		</Screen>
	);
}

/** Development builds only: runs the background task now (manual checks). */
function RunBackgroundTask() {
	const run = useRunBackgroundSync();
	return (
		<Button
			variant="ghost"
			icon="bug-outline"
			label="Rodar a tarefa em segundo plano (debug)"
			pending={run.isPending}
			onPress={() => run.mutate()}
		/>
	);
}

function FailureRow({ failure }: { failure: FailureView }) {
	const retry = useRetryFailures();
	const discard = useDiscardFailures();
	const ids = [failure.mutationId, ...failure.dependents];

	const confirmDiscard = () => {
		const extra = failure.dependents.length;
		Alert.alert(
			"Descartar alteração?",
			extra > 0
				? `Ela e ${extra} ${extra === 1 ? "alteração que depende" : "alterações que dependem"} dela serão apagadas deste aparelho.`
				: "Ela será apagada deste aparelho.",
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Descartar",
					style: "destructive",
					onPress: () => discard.mutate(ids),
				},
			]
		);
	};

	return (
		<View className="gap-3 rounded-xl border border-night-danger bg-night-danger-surface p-4">
			<View className="gap-1">
				<Text className="text-base font-semibold text-night-foreground">
					{failure.action}
				</Text>
				<Text className="text-sm text-night-danger">{failure.reason}</Text>
			</View>
			<View className="flex-row flex-wrap gap-2">
				<Button
					variant="secondary"
					icon="refresh"
					label="Tentar de novo"
					pending={retry.isPending}
					onPress={() => retry.mutate(ids)}
				/>
				<Button
					variant="danger"
					icon="delete-outline"
					label="Descartar"
					pending={discard.isPending}
					onPress={confirmDiscard}
				/>
			</View>
		</View>
	);
}
