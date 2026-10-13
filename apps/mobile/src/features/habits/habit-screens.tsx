import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Text, View } from "react-native";
import { errorMessage, isUnauthorized } from "@/data/errors.ts";
import {
	isSettled,
	useCreateHabit,
	useDeleteHabit,
	useHabits,
	useRestoreHabit,
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
	const remove = useDeleteHabit();
	const restore = useRestoreHabit();
	const onError = useErrorToast("Não foi possível salvar o hábito");
	const onDeleteError = useErrorToast("Não foi possível apagar o hábito");
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

					// The undo outlives this screen (it closes on success), so it
					// uses the promise, not callbacks tied to the screen.
					const undoDelete = () => {
						restore.mutateAsync(habit.id).then(
							() => toast("info", "Hábito restaurado", habit.name),
							(error: Error) => {
								if (!isUnauthorized(error)) {
									toast(
										"error",
										"Não foi possível restaurar o hábito",
										errorMessage(error)
									);
								}
							}
						);
					};
					const deleteHabit = () =>
						remove.mutate(habit.id, {
							onSuccess: () => {
								toast("info", "Hábito apagado", habit.name, {
									action: { label: "Desfazer", onPress: undoDelete },
								});
								router.back();
							},
							onError: onDeleteError,
						});

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
							<View className="gap-3 border-t border-night-border pt-6">
								<Text className="text-sm text-night-muted">
									{archived
										? "Arquivado: não aparece nos dias a partir do arquivamento. Restaurar o traz de volta."
										: "Arquivar tira o hábito dos próximos dias e mantém o histórico."}
								</Text>
								{archived ? (
									<>
										<Button
											variant="secondary"
											icon="archive-arrow-up-outline"
											label="Desarquivar"
											disabled={update.isPending || remove.isPending}
											onPress={() => setArchived(false)}
										/>
										{/* 2.11.0: only archived habits can be deleted. */}
										<Text className="pt-3 text-sm text-night-muted">
											Apagar tira o hábito e todo o histórico dele do mapa e dos
											dias.
										</Text>
										<Button
											variant="danger"
											icon="trash-can-outline"
											label="Apagar hábito"
											disabled={update.isPending || remove.isPending}
											onPress={() =>
												Alert.alert(
													"Apagar hábito?",
													`"${habit.name}" e todo o histórico dele saem do mapa e dos dias. Para manter o histórico, deixe-o arquivado.`,
													[
														{ text: "Cancelar", style: "cancel" },
														{
															text: "Apagar",
															style: "destructive",
															onPress: () => deleteHabit(),
														},
													]
												)
											}
										/>
									</>
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
