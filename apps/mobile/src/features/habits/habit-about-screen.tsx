import { MaterialCommunityIcons } from "@expo/vector-icons";
import { hasDescription, parseDescription } from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { isSettled, useHabits, useScheduleOptions } from "@/data/hooks.ts";
import { useToday } from "@/data/today.ts";
import { Backdrop } from "@/ui/backdrop.tsx";
import { Button } from "@/ui/button.tsx";
import { DescriptionText } from "@/ui/description-text.tsx";
import { DisplayText } from "@/ui/display-text.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { nextBadge, ScheduleStrip } from "./habit-card.tsx";

// One short entrance per panel (DESIGN.md: 120-200 ms, none with reduced
// motion), the description a beat after the header.
const HEADER_ENTER = FadeInDown.duration(200).reduceMotion(ReduceMotion.System);
const BODY_ENTER = FadeInDown.duration(200)
	.delay(60)
	.reduceMotion(ReduceMotion.System);

/**
 * A habit's screen (2.12.0): who it is and when it happens (the card's week
 * strip and badge), then the whole description, where "Abrir descrição
 * completa" of the quick look leads. "Editar" sits in the fixed footer.
 */
export function HabitAboutScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const habits = useHabits();
	const today = useToday();
	const scheduleOptions = useScheduleOptions();
	useHideSplashWhen(isSettled(habits));
	const habit = habits.data?.find((item) => item.id === id);
	const edit = () => router.push(`/habit/${id}`);

	return (
		<Screen
			edges={["bottom"]}
			background={<Backdrop />}
			footer={
				habit ? (
					<Button
						variant="secondary"
						icon="pencil-outline"
						label="Editar"
						onPress={edit}
						className="min-h-14"
					/>
				) : undefined
			}
		>
			<QueryState query={habits}>
				{(list) => {
					const found = list.find((item) => item.id === id);
					if (!found) {
						return (
							<EmptyState
								title="Hábito não encontrado"
								description="Ele pode ter sido apagado em outro aparelho."
								action={
									<Button
										variant="secondary"
										label="Voltar"
										onPress={() => router.back()}
									/>
								}
							/>
						);
					}
					const badge = nextBadge(found, today, scheduleOptions);
					return (
						<View className="gap-8">
							<Animated.View entering={HEADER_ENTER}>
								<View className="gap-4 rounded-2xl border border-night-border bg-night-surface p-5">
									<View className="flex-row items-center gap-2">
										<Text className="text-sm text-night-muted">Hábito</Text>
										{found.archived_at !== null ? (
											<View className="flex-row items-center gap-1 rounded-full border border-night-border px-2 py-0.5">
												<MaterialCommunityIcons
													name="archive-outline"
													size={12}
													color={nightColors.muted}
												/>
												<Text className="text-xs text-night-muted">
													Arquivado
												</Text>
											</View>
										) : null}
									</View>
									<DisplayText
										accessibilityRole="header"
										className="text-3xl tracking-tight text-night-foreground"
									>
										{found.name}
									</DisplayText>
									<View className="flex-row flex-wrap items-center gap-x-4 gap-y-3">
										<ScheduleStrip habit={found} today={today} muted={false} />
										{badge ? (
											<Text
												className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.today ? "bg-night-success-surface text-night-success" : "border border-night-border font-normal text-night-muted"}`}
											>
												{badge.text}
											</Text>
										) : null}
									</View>
								</View>
							</Animated.View>

							<Animated.View entering={BODY_ENTER} style={{ gap: 12 }}>
								<View className="flex-row items-center gap-2">
									<MaterialCommunityIcons
										name="text-box-outline"
										size={20}
										color={nightColors.accent.text}
									/>
									<DisplayText
										weight="semibold"
										accessibilityRole="header"
										className="text-lg text-night-foreground"
									>
										Descrição
									</DisplayText>
								</View>
								{hasDescription(found) ? (
									<View className="rounded-2xl border border-night-border bg-night-surface p-5">
										<DescriptionText
											blocks={parseDescription(found.description)}
											variant="reading"
										/>
									</View>
								) : (
									<View className="items-center gap-3 rounded-2xl border border-dashed border-night-border p-8">
										<Text className="text-center text-base text-night-muted">
											Sem descrição ainda. Anote passos, detalhes ou um link.
										</Text>
										<Button
											variant="secondary"
											icon="plus"
											label="Adicionar descrição"
											onPress={edit}
										/>
									</View>
								)}
							</Animated.View>
						</View>
					);
				}}
			</QueryState>
		</Screen>
	);
}
