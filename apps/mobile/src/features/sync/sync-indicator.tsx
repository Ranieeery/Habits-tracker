import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSyncStatus } from "@/data/hooks.ts";
import { type SyncTone, syncLabel } from "@/lib/sync-label.ts";

const TONE_COLOR: Record<SyncTone, string> = {
	ok: colors.muted,
	busy: colors.violet[400],
	pending: colors.violet[300],
	offline: colors.muted,
	danger: colors.danger.DEFAULT,
};

/** Discreet sync state; opens the sync screen (status, failures). */
export function SyncIndicator() {
	const router = useRouter();
	const status = useSyncStatus();
	const { tone, label, icon } = syncLabel(status);
	const color = TONE_COLOR[tone];

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Sincronização: ${label}`}
			accessibilityHint="Abre os detalhes da sincronização"
			onPress={() => router.push("/sync")}
			hitSlop={8}
			className="min-h-touch flex-row items-center gap-1.5 self-start rounded-md px-2 active:bg-surface"
		>
			<MaterialCommunityIcons name={icon} size={16} color={color} />
			<Text style={{ color }} className="text-xs font-semibold">
				{label}
			</Text>
		</Pressable>
	);
}
