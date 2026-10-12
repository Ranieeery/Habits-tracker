import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import {
	isSettled,
	useCreateHabit,
	useHabits,
	useUpdateHabit,
} from "@/data/hooks.ts";
import { useToday, useUserTimeZone } from "@/data/today.ts";
import { Button } from "@/ui/button.tsx";
import { Screen } from "@/ui/screen.tsx";
import { useHideSplashWhen } from "@/ui/splash.ts";
import { EmptyState, QueryState } from "@/ui/states.tsx";
import { useToast } from "@/ui/toast.tsx";
import { HabitForm } from "./habit-form.tsx";

function useErrorToast(title: string) {
	const toast = useToast();
	return (error: Error) => {
		if (!isUnauthorized(error)) toast("error", title, errorMessage(error));
	};
}

export function NewHabitScreen() {
	useHideSplashWhen(true);
	const router = useRouter();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const toast = useToast();
	const create = useCreateHabit();
	const onError = useErrorToast("Não foi possível criar o hábito");

	return (
		<Screen edges={["bottom"]}>
			<HabitForm
				today={today}
				timeZone={timeZone}
				submitLabel="Criar hábito"
				pending={create.isPending}
				onSubmit={({ name, schedule, start_date }) =>
					schedule &&
					create.mutate(
						// Starts today or later ("Começa em"): never rewrites past days.
						{ name, schedule, start_date },
						{
							onSuccess: (habit) => {
								toast("success", "Hábito criado", habit.name);
								router.back();
							},
							onError,
						}
					)
				}
			/>
		</Screen>
	);
}

export function EditHabitScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const toast = useToast();
	const habits = useHabits();
	const today = useToday();
	const timeZone = useUserTimeZone();
	const update = useUpdateHabit();
	const onError = useErrorToast("Não foi possível salvar o hábito");
	useHideSplashWhen(isSettled(habits));

	return (
		<Screen edges={["bottom"]}>
			<QueryState query={habits}>
				{(list) => {
					const habit = list.find((item) => item.id === id);
					if (!habit) {
						return (
							<EmptyState
								title="Hábito não encontrado"
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
					const archived = habit.archived_at !== null;
					const setArchived = (value: boolean) =>
						update.mutate(
							{ habitId: habit.id, changes: { archived: value } },
							{
								onSuccess: () => {
									toast(
										"success",
										value ? "Hábito arquivado" : "Hábito restaurado",
										habit.name
									);
									router.back();
								},
								onError,
							}
						);

					return (
						<View className="gap-10">
							<HabitForm
								initial={habit}
								today={today}
								timeZone={timeZone}
								submitLabel="Salvar"
								pending={update.isPending}
								onSubmit={(values) =>
									update.mutate(
										{
											habitId: habit.id,
											changes: {
												name: values.name,
												...(values.schedule && { schedule: values.schedule }),
											},
										},
										{
											onSuccess: () => {
												toast("success", "Hábito salvo", values.name);
												router.back();
											},
											onError,
										}
									)
								}
							/>
							<View className="gap-3 border-t border-border pt-6">
								<Text className="text-sm text-muted">
									{archived
										? "Arquivado: não aparece nos dias a partir do arquivamento. Restaurar o traz de volta."
										: "Arquivar tira o hábito dos próximos dias e mantém o histórico."}
								</Text>
								{archived ? (
									<Button
										variant="secondary"
										icon="archive-arrow-up-outline"
										label="Desarquivar"
										disabled={update.isPending}
										onPress={() => setArchived(false)}
									/>
								) : (
									<Button
										variant="danger"
										icon="archive-outline"
										label="Arquivar"
										disabled={update.isPending}
										onPress={() =>
											Alert.alert(
												"Arquivar hábito?",
												`"${habit.name}" deixa de aparecer nos próximos dias. O histórico continua no mapa.`,
												[
													{ text: "Cancelar", style: "cancel" },
													{
														text: "Arquivar",
														style: "destructive",
														onPress: () => setArchived(true),
													},
												]
											)
										}
									/>
								)}
							</View>
						</View>
					);
				}}
			</QueryState>
		</Screen>
	);
}
