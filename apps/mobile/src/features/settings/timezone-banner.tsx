import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { useState } from "react";
import { Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import { useUpdateTimeZone } from "@/data/hooks.ts";
import { useServices } from "@/data/services.ts";
import { useUserTimeZone } from "@/data/today.ts";
import { shouldOfferTimeZoneUpdate, timeZonePairKey } from "@/lib/time-zone.ts";
import { Button } from "@/ui/button.tsx";
import { useToast } from "@/ui/toast.tsx";

/** Pairs the user chose to keep, for this app run. */
const kept = new Set<string>();

/**
 * Discreet notice when the device's time zone differs from the saved one.
 * Never changes the setting on its own: the user picks "Atualizar" or
 * "Manter".
 */
export function TimezoneBanner() {
	const { deviceTimeZone } = useServices();
	const saved = useUserTimeZone();
	const device = deviceTimeZone();
	const [, setKeptCount] = useState(kept.size);
	const update = useUpdateTimeZone();
	const toast = useToast();

	if (!shouldOfferTimeZoneUpdate(device, saved, kept)) return null;

	return (
		<View
			accessibilityRole="summary"
			className="gap-3 rounded-xl border border-night-border bg-night-surface p-4"
		>
			<View className="flex-row gap-3">
				<MaterialCommunityIcons
					name="earth"
					size={20}
					color={nightColors.muted}
				/>
				<Text className="flex-1 text-sm text-night-muted">
					Este aparelho está em{" "}
					<Text className="font-semibold text-night-foreground">{device}</Text>,
					mas seus dias são contados em{" "}
					<Text className="font-semibold text-night-foreground">{saved}</Text>.
				</Text>
			</View>
			<View className="flex-row flex-wrap gap-2">
				<Button
					variant="secondary"
					label="Atualizar"
					accessibilityHint={`Passa a contar os dias em ${device}`}
					pending={update.isPending}
					onPress={() =>
						update.mutate(device, {
							onSuccess: (settings) =>
								toast("success", "Fuso horário atualizado", settings.timezone),
							onError: (error) => {
								if (!isUnauthorized(error)) {
									toast(
										"error",
										"Não foi possível salvar o fuso",
										errorMessage(error)
									);
								}
							},
						})
					}
				/>
				<Button
					variant="ghost"
					label="Manter"
					onPress={() => {
						kept.add(timeZonePairKey(device, saved));
						setKeptCount(kept.size);
					}}
				/>
			</View>
		</View>
	);
}
