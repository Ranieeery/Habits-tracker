import { HabitName, type Schedule, WeekdaysSchedule } from "@habits/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { weekdayInitial, weekdayName } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { FieldError, TextField } from "@/ui/text-field.tsx";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export interface HabitFormValues {
	name: string;
	schedule: Schedule;
}

interface Errors {
	name?: string;
	days?: string;
}

/** Sunday = 0 ... Saturday = 6, as 44 dp toggle buttons. */
export function WeekdayPicker({
	value,
	onChange,
}: {
	value: number[];
	onChange: (days: number[]) => void;
}) {
	const toggle = (day: number) =>
		onChange(
			value.includes(day)
				? value.filter((d) => d !== day)
				: [...value, day].sort((a, b) => a - b)
		);

	return (
		<View className="flex-row flex-wrap gap-2">
			{WEEKDAYS.map((day) => {
				const selected = value.includes(day);
				return (
					<Pressable
						key={day}
						accessibilityRole="checkbox"
						accessibilityLabel={weekdayName(day)}
						accessibilityState={{ checked: selected }}
						onPress={() => toggle(day)}
						className={`size-touch items-center justify-center rounded-md border-2 ${selected ? "border-violet-500 bg-violet-600" : "border-border bg-surface active:bg-border"}`}
					>
						<Text
							className={`text-base font-bold ${selected ? "text-foreground" : "text-muted"}`}
						>
							{weekdayInitial(day)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export function HabitForm({
	initial,
	submitLabel,
	pending = false,
	onSubmit,
}: {
	initial?: HabitFormValues;
	submitLabel: string;
	pending?: boolean;
	onSubmit: (values: HabitFormValues) => void;
}) {
	const [name, setName] = useState(initial?.name ?? "");
	const [days, setDays] = useState<number[]>(
		initial?.schedule.type === "weekdays" ? initial.schedule.days : []
	);
	const [errors, setErrors] = useState<Errors>({});

	const submit = () => {
		const parsedName = HabitName.safeParse(name);
		const parsedSchedule = WeekdaysSchedule.safeParse({
			type: "weekdays",
			days: [...days].sort((a, b) => a - b),
		});
		setErrors({
			name: parsedName.success ? undefined : "Dê um nome ao hábito.",
			days: parsedSchedule.success
				? undefined
				: "Escolha pelo menos um dia da semana.",
		});
		if (parsedName.success && parsedSchedule.success) {
			onSubmit({ name: parsedName.data, schedule: parsedSchedule.data });
		}
	};

	return (
		<View className="gap-6">
			<TextField
				label="Qual é o hábito?"
				value={name}
				onChangeText={setName}
				maxLength={120}
				placeholder="Ex.: exercícios, dormir bem, beber água…"
				autoCapitalize="sentences"
				returnKeyType="done"
				error={errors.name}
			/>

			<View className="gap-2">
				<Text className="text-sm font-semibold text-foreground">
					Em quais dias da semana?
				</Text>
				<WeekdayPicker value={days} onChange={setDays} />
				<FieldError>{errors.days}</FieldError>
			</View>

			<Button label={submitLabel} pending={pending} onPress={submit} />
		</View>
	);
}
