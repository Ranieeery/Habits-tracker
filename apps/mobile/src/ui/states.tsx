import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DataError, errorMessage } from "@/data/errors.ts";
import { Button } from "./button.tsx";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			className="min-h-40 flex-row items-center justify-center gap-3"
		>
			<ActivityIndicator color={colors.violet[600]} />
			<Text className="text-muted">{label}</Text>
		</View>
	);
}

/** Full error state with a retry button. */
export function ErrorState({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry?: () => void;
}) {
	const offline = error instanceof DataError && error.kind === "offline";
	return (
		<View
			accessibilityRole="alert"
			className="items-center gap-4 rounded-xl border border-danger bg-danger-surface p-6"
		>
			<MaterialCommunityIcons
				name={offline ? "cloud-off-outline" : "alert-circle-outline"}
				size={32}
				color={colors.danger.DEFAULT}
			/>
			<Text className="text-center text-base text-foreground">
				{errorMessage(error)}
			</Text>
			{onRetry ? (
				<Button
					variant="secondary"
					label="Tentar novamente"
					onPress={onRetry}
				/>
			) : null}
		</View>
	);
}

/** Shown while a query waits for the network to come back. */
export function OfflineState() {
	return (
		<View
			accessibilityRole="alert"
			className="items-center gap-3 rounded-xl border border-border bg-surface p-6"
		>
			<MaterialCommunityIcons name="wifi-off" size={32} color={colors.muted} />
			<Text className="text-center text-base text-foreground">
				Sem conexão. Os dados aparecem assim que a internet voltar.
			</Text>
		</View>
	);
}

export function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<View className="items-center gap-3 rounded-xl border border-dashed border-border p-8">
			<Text className="text-center text-lg font-bold text-foreground">
				{title}
			</Text>
			{description ? (
				<Text className="text-center text-sm text-muted">{description}</Text>
			) : null}
			{action}
		</View>
	);
}

/**
 * Picks the state for a query: offline, loading, error, or the content.
 * Keeps every screen's loading/error handling the same.
 */
export function QueryState<T>({
	query,
	loadingLabel,
	children,
}: {
	query: {
		data: T | undefined;
		error: unknown;
		isPending: boolean;
		fetchStatus: string;
		refetch: () => unknown;
	};
	loadingLabel?: string;
	children: (data: T) => ReactNode;
}) {
	if (query.data !== undefined) return children(query.data);
	if (query.isPending && query.fetchStatus === "paused")
		return <OfflineState />;
	if (query.error) {
		return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
	}
	return <LoadingState label={loadingLabel} />;
}
