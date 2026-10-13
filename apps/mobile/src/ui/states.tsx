import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DataError, errorMessage } from "@/data/errors.ts";
import { Button } from "./button.tsx";
import { DisplayText } from "./display-text.tsx";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			className="min-h-40 flex-row items-center justify-center gap-3"
		>
			<ActivityIndicator color={nightColors.accent.DEFAULT} />
			<Text className="text-night-muted">{label}</Text>
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
			className="items-center gap-4 rounded-xl border border-night-danger bg-night-danger-surface p-6"
		>
			<MaterialCommunityIcons
				name={offline ? "cloud-off-outline" : "alert-circle-outline"}
				size={32}
				color={nightColors.danger.DEFAULT}
			/>
			<Text className="text-center text-base text-night-foreground">
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
			className="items-center gap-3 rounded-xl border border-night-border bg-night-surface p-6"
		>
			<MaterialCommunityIcons
				name="wifi-off"
				size={32}
				color={nightColors.muted}
			/>
			<Text className="text-center text-base text-night-foreground">
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
		<View className="items-center gap-3 rounded-xl border border-dashed border-night-border p-8">
			<DisplayText
				weight="semibold"
				className="text-center text-xl text-night-foreground"
			>
				{title}
			</DisplayText>
			{description ? (
				<Text className="text-center text-sm text-night-muted">
					{description}
				</Text>
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
