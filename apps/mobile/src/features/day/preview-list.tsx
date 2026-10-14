import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Habit } from "@habits/contracts";
import {
	descriptionFirstLine,
	hasDescription,
	type PreviewItem,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DescriptionSheet } from "@/features/habits/description-sheet.tsx";

/**
 * What is planned for a preview day (2.14.0) in one `night-surface` panel,
 * read only: no checkbox, nothing to mark. Each row is one accessible
 * element ("Nome, vence neste dia"); a deadline task due that day carries
 * the "Vence neste dia" badge (icon and text). The note icon still opens
 * the description, like on any other day.
 */
export function PreviewList({ items }: { items: readonly PreviewItem[] }) {
	const [described, setDescribed] = useState<Habit | null>(null);
	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			<DescriptionSheet habit={described} onClose={() => setDescribed(null)} />
			{items.map(({ habit, dueOnDay }, index) => {
				const firstLine = descriptionFirstLine(habit.description);
				return (
					<View
						key={habit.id}
						className={`flex-row items-center ${index > 0 ? "border-t border-night-border" : ""}`}
					>
						<View
							accessible
							accessibilityLabel={
								dueOnDay ? `${habit.name}, vence neste dia` : habit.name
							}
							className="min-h-14 flex-1 flex-row items-center gap-4 px-4 py-3"
						>
							<MaterialCommunityIcons
								name="circle-outline"
								size={20}
								color={nightColors.subtle}
							/>
							<View className="flex-1 items-start gap-1.5">
								<Text className="text-base font-medium text-night-foreground">
									{habit.name}
								</Text>
								{firstLine ? (
									<Text
										numberOfLines={1}
										className="self-stretch text-sm text-night-muted"
									>
										{firstLine}
									</Text>
								) : null}
								{dueOnDay ? (
									<View className="flex-row items-center gap-1 rounded-md border border-night-accent/40 bg-night-accent/15 px-2 py-0.5">
										<MaterialCommunityIcons
											name="calendar-end"
											size={14}
											color={nightColors.accent.text}
										/>
										<Text className="text-xs font-medium text-night-accent-text">
											Vence neste dia
										</Text>
									</View>
								) : null}
							</View>
						</View>
						{hasDescription(habit) ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Descrição de ${habit.name}`}
								onPress={() => setDescribed(habit)}
								className="mr-2 size-touch items-center justify-center rounded-md active:bg-night-surface-raised"
							>
								<MaterialCommunityIcons
									name="text-box-outline"
									size={22}
									color={nightColors.muted}
								/>
							</Pressable>
						) : null}
					</View>
				);
			})}
		</View>
	);
}
