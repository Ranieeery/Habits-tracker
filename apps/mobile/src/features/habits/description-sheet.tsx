import type { Habit } from "@habits/contracts";
import { descriptionPreview } from "@habits/core";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton } from "@/ui/button.tsx";
import { DescriptionText } from "@/ui/description-text.tsx";
import { DisplayText } from "@/ui/display-text.tsx";

/**
 * The quick look at a habit's description (2.12.0), opened from the note icon
 * of a day's row: the first lines (core `descriptionPreview`) and, when
 * something was left out, "Abrir descrição completa" (the habit's screen).
 * A Modal like the other sheets: back and a tap outside close it.
 */
export function DescriptionSheet({
	habit,
	onClose,
}: {
	habit: Pick<Habit, "id" | "name" | "description"> | null;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const preview = habit ? descriptionPreview(habit.description) : null;

	return (
		<Modal
			visible={habit !== null}
			transparent
			animationType="slide"
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={onClose}
		>
			<View style={[styles.bottom, { paddingTop: insets.top + 8 }]}>
				<Pressable
					accessible={false}
					importantForAccessibility="no"
					onPress={onClose}
					style={StyleSheet.absoluteFill}
					className="bg-night-bg/70"
				/>
				{habit && preview ? (
					<View
						accessibilityViewIsModal
						className="gap-4 rounded-t-2xl border-t border-night-border bg-night-surface px-4 pt-2"
						style={{ paddingBottom: insets.bottom + 16, flexShrink: 1 }}
					>
						<View className="items-center py-1">
							<View className="h-1 w-10 rounded-full bg-night-surface-raised" />
						</View>
						<View className="flex-row items-center justify-between gap-2">
							<DisplayText
								accessibilityRole="header"
								className="flex-1 text-2xl tracking-tight text-night-foreground"
							>
								{habit.name}
							</DisplayText>
							<IconButton icon="close" label="Fechar" onPress={onClose} />
						</View>
						<ScrollView style={{ flexShrink: 1 }}>
							<DescriptionText blocks={preview.blocks} />
						</ScrollView>
						{preview.truncated ? (
							<Button
								variant="secondary"
								icon="arrow-right"
								label="Abrir descrição completa"
								onPress={() => {
									onClose();
									router.push(`/habit/about/${habit.id}`);
								}}
								className="min-h-14"
							/>
						) : null}
					</View>
				) : null}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	bottom: { flex: 1, justifyContent: "flex-end" },
});
