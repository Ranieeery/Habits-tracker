import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SyncIndicator } from "@/features/sync/sync-indicator.tsx";
import { IconButton } from "@/ui/button.tsx";
import { Wordmark } from "@/ui/wordmark.tsx";

/**
 * Top of every tab (2.6.0): the mark (or the tab's own title), the discreet
 * sync state and the gear to Ajustes. Only things that are read or rarely
 * used live here, out of the thumb's way; it wraps below the mark when a big
 * system font leaves no room.
 */
export function TabHeader({ title }: { title?: ReactNode }) {
	const router = useRouter();
	return (
		<View className="flex-row flex-wrap items-center justify-between gap-x-3">
			{title ?? <Wordmark />}
			<View className="flex-row items-center">
				<SyncIndicator />
				<IconButton
					icon="cog-outline"
					label="Ajustes"
					onPress={() => router.push("/settings")}
				/>
			</View>
		</View>
	);
}
