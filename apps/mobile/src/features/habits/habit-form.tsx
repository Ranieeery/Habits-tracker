import {
	type CalendarDate,
	HabitName,
	type Schedule,
	type StoredSchedule,
} from "@habits/contracts";
import {
	buildFromDraft,
	type DraftErrors,
	draftFromHabit,
	emptyDraft,
	type HabitDraft,
	MONTH_NAMES,
	previewHabit,
	REPEAT_KINDS,
	UNSUPPORTED_SCHEDULE_TEXT,
} from "@habits/core";
import { type Ref, useState } from "react";
import { Alert, Text, type TextInput, View } from "react-native";
import { weekdayInitial, weekdayName } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { Choice } from "@/ui/choice.tsx";
import { DatePicker } from "@/ui/date-picker.tsx";
import { FieldError, TextField } from "@/ui/text-field.tsx";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export interface HabitFormValues {
	name: string;
	/** Absent when editing a habit whose repetition this version cannot edit. */
	schedule?: Schedule;
	/** "Começa em" (used when creating). */
	start_date: CalendarDate;
}

/** An existing habit being edited. */
export interface HabitFormInitial {
	name: string;
	schedule: StoredSchedule;
	start_date: CalendarDate;
}

function toggled(values: number[], value: number): number[] {
	return values.includes(value)
		? values.filter((v) => v !== value)
		: [...values, value].sort((a, b) => a - b);
}

/** Sunday = 0 ... Saturday = 6, as 44 dp toggle buttons. */
export function WeekdayPicker({
	value,
	onChange,
}: {
	value: number[];
	onChange: (days: number[]) => void;
}) {
	return (
		<View className="flex-row flex-wrap gap-2">
			{WEEKDAYS.map((day) => (
				<Choice
					key={day}
					label={weekdayInitial(day)}
					accessibilityLabel={weekdayName(day)}
					selected={value.includes(day)}
					className="size-touch px-0"
					onPress={() => onChange(toggled(value, day))}
				/>
			))}
		</View>
	);
}

/** Days 1-31 in rows of 7 (single choice for yearly, multiple for monthly). */
function MonthDayGrid({
	selected,
	role,
	onPress,
}: {
	selected: (day: number) => boolean;
	role: "checkbox" | "radio";
	onPress: (day: number) => void;
}) {
	return (
		<View className="flex-row flex-wrap gap-1">
			{MONTH_DAYS.map((day) => (
				<Choice
					key={day}
					role={role}
					label={String(day)}
					accessibilityLabel={`Dia ${day}`}
					selected={selected(day)}
					className="w-[13%] px-0"
					onPress={() => onPress(day)}
				/>
			))}
		</View>
	);
}

function sameSchedule(a: StoredSchedule, b: Schedule): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The habit form (habits tab and today's sheet): name and repetition. The
 * fields, validation, schedule and preview come from `@habits/core`
 * (`buildFromDraft`, `previewHabit`), the same as the web. Changing the
 * repetition of a habit that already started asks for confirmation.
 */
export function HabitForm({
	initial,
	today,
	timeZone,
	submitLabel,
	pending = false,
	error,
	nameRef,
	onSubmit,
}: {
	/** The habit being edited (absent: a new habit). */
	initial?: HabitFormInitial;
	today: CalendarDate;
	timeZone: string;
	submitLabel: string;
	pending?: boolean;
	/** A failure to save, shown above the button; the typed values stay. */
	error?: string;
	/** The name input, for focusing it when a sheet opens. */
	nameRef?: Ref<TextInput>;
	onSubmit: (values: HabitFormValues) => void;
}) {
	const editing = initial
		? { schedule: initial.schedule, start_date: initial.start_date }
		: undefined;
	const [name, setName] = useState(initial?.name ?? "");
	// null: a repetition this version cannot edit (name only).
	const [draft, setDraft] = useState<HabitDraft | null>(() =>
		initial ? draftFromHabit(initial, today) : emptyDraft(today)
	);
	const [nameError, setNameError] = useState<string>();
	const [errors, setErrors] = useState<DraftErrors>({});

	const update = (changes: Partial<HabitDraft>) =>
		setDraft((current) => (current ? { ...current, ...changes } : current));

	const built = draft ? buildFromDraft(draft, { today, editing }) : null;
	const preview =
		built?.ok === true
			? previewHabit(
					{ schedule: built.schedule, start_date: built.start_date },
					today,
					{ timeZone }
				)
			: null;

	const submit = () => {
		// Enter on the keyboard can submit while the button is disabled.
		if (pending) return;
		const parsedName = HabitName.safeParse(name);
		setNameError(parsedName.success ? undefined : "Dê um nome ao hábito.");
		setErrors(built && !built.ok ? built.errors : {});
		if (!parsedName.success || (built && !built.ok)) return;

		const values: HabitFormValues =
			built?.ok === true
				? {
						name: parsedName.data,
						schedule: built.schedule,
						start_date: built.start_date,
					}
				: { name: parsedName.data, start_date: initial?.start_date ?? today };
		const reschedules =
			initial !== undefined &&
			values.schedule !== undefined &&
			!sameSchedule(initial.schedule, values.schedule) &&
			initial.start_date < today;
		if (!reschedules) {
			onSubmit(values);
			return;
		}
		Alert.alert(
			"Mudar a repetição?",
			"Mudar a repetição recalcula os dias passados do heatmap. Dias já marcados continuam contando.",
			[
				{ text: "Cancelar", style: "cancel" },
				{ text: "Salvar", onPress: () => onSubmit(values) },
			]
		);
	};

	const kindError = draft
		? (errors.weekdays ??
			errors.every ??
			errors.monthDays ??
			errors.date ??
			errors.day)
		: undefined;
	// "Começa em": new habits (except single dates) and the interval's anchor.
	const showStart =
		draft !== null &&
		draft.kind !== "once" &&
		(!initial || draft.kind === "interval");

	return (
		<View className="gap-6">
			<TextField
				ref={nameRef}
				label="Qual é o hábito?"
				value={name}
				onChangeText={setName}
				maxLength={120}
				placeholder="Ex.: exercícios, consulta, pagar condomínio…"
				autoCapitalize="sentences"
				returnKeyType="done"
				// The keyboard's Enter key submits the form.
				onSubmitEditing={submit}
				error={nameError}
			/>

			{draft === null ? (
				<Text className="rounded-md border border-border p-3 text-sm text-muted">
					{UNSUPPORTED_SCHEDULE_TEXT}. Atualize o app para mudar a repetição;
					aqui você pode renomear ou arquivar o hábito.
				</Text>
			) : (
				<>
					<View className="gap-2">
						<Text className="text-sm font-semibold text-foreground">
							Repetição
						</Text>
						<View
							accessibilityRole="radiogroup"
							className="flex-row flex-wrap gap-2"
						>
							{REPEAT_KINDS.map(({ kind, label }) => (
								<Choice
									key={kind}
									role="radio"
									label={label}
									selected={draft.kind === kind}
									onPress={() => update({ kind })}
								/>
							))}
						</View>
					</View>

					<View className="gap-2">
						{draft.kind === "weekdays" && (
							<>
								<Text className="text-sm font-semibold text-foreground">
									Em quais dias da semana?
								</Text>
								<WeekdayPicker
									value={draft.weekdays}
									onChange={(weekdays) => update({ weekdays })}
								/>
							</>
						)}
						{draft.kind === "interval" && (
							<TextField
								label="A cada quantos dias?"
								value={draft.every}
								onChangeText={(every) => update({ every })}
								keyboardType="number-pad"
								maxLength={3}
								error={errors.every}
							/>
						)}
						{draft.kind === "monthly_days" && (
							<>
								<Text className="text-sm font-semibold text-foreground">
									Em quais dias do mês?
								</Text>
								<MonthDayGrid
									role="checkbox"
									selected={(day) => draft.monthDays.includes(day)}
									onPress={(day) =>
										update({ monthDays: toggled(draft.monthDays, day) })
									}
								/>
								<Text className="text-xs text-muted">
									Em meses sem o dia escolhido (como 31 ou 30 em fevereiro),
									vale o último dia do mês.
								</Text>
							</>
						)}
						{draft.kind === "once" && (
							<DatePicker
								label="Em qual data?"
								value={draft.date}
								min={
									editing && editing.start_date > today
										? editing.start_date
										: today
								}
								error={errors.date}
								onChange={(date) => update({ date })}
							/>
						)}
						{draft.kind === "yearly" && (
							<>
								<Text className="text-sm font-semibold text-foreground">
									Em qual mês?
								</Text>
								<View
									accessibilityRole="radiogroup"
									className="flex-row flex-wrap gap-1"
								>
									{MONTH_NAMES.map((month, index) => (
										<Choice
											key={month}
											role="radio"
											label={month.slice(0, 3)}
											accessibilityLabel={month}
											selected={draft.month === index + 1}
											className="w-[23%] px-0"
											onPress={() => update({ month: index + 1 })}
										/>
									))}
								</View>
								<Text className="text-sm font-semibold text-foreground">
									Em qual dia?
								</Text>
								<MonthDayGrid
									role="radio"
									selected={(day) => draft.day === day}
									onPress={(day) => update({ day })}
								/>
								{draft.month === 2 && draft.day === 29 ? (
									<Text className="text-xs text-muted">
										Em anos não bissextos, vale 28/02.
									</Text>
								) : null}
							</>
						)}
						{draft.kind !== "interval" && draft.kind !== "once" ? (
							<FieldError>{kindError}</FieldError>
						) : null}
					</View>

					{showStart && (
						<DatePicker
							label="Começa em"
							value={draft.start}
							min={today}
							error={errors.start}
							onChange={(start) => update({ start })}
						/>
					)}

					<View
						accessibilityLiveRegion="polite"
						className="rounded-md border border-border bg-background px-3 py-2"
					>
						{preview ? (
							<>
								<Text className="text-sm text-foreground">
									{preview.summary}
								</Text>
								{preview.next ? (
									<Text className="text-sm text-muted">{preview.next}</Text>
								) : null}
							</>
						) : (
							<Text className="text-sm text-muted">Complete a repetição.</Text>
						)}
					</View>
				</>
			)}

			<FieldError>{error}</FieldError>

			<Button label={submitLabel} pending={pending} onPress={submit} />
		</View>
	);
}
