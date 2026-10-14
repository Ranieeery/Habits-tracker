import {
	type CalendarDate,
	HabitName,
	type Schedule,
	type StoredSchedule,
	DESCRIPTION_MAX_LENGTH,
} from "@habits/contracts";
import {
	addMonths,
	buildFromDraft,
	clampDayToMonth,
	daysInAnyYear,
	type DraftErrors,
	draftFromHabit,
	emptyDraft,
	type HabitDraft,
	MONTH_NAMES,
	previewHabit,
	REPEAT_KINDS,
	UNSUPPORTED_SCHEDULE_TEXT,
	DEADLINE_LOCKED,
	DESCRIPTION_COUNTER_FROM,
	descriptionError,
	formatDayMonthYear,
	isDeadlinePast,
	isHabitFormDirty,
	latestDueDate,
	NO_RESCHEDULES,
	normalizeHabitForm,
	orphanedReschedules,
	orphanNotice,
	type RescheduleIndex,
} from "@habits/core";
import { type Ref, useEffect, useState } from "react";
import { Alert, Text, type TextInput, View } from "react-native";
import { capitalizeFirst, weekdayInitial, weekdayName } from "@/lib/format.ts";
import { Button } from "@/ui/button.tsx";
import { Choice } from "@/ui/choice.tsx";
import { DatePicker } from "@/ui/date-picker.tsx";
import { MonthDayPicker } from "@/ui/month-day-picker.tsx";
import { FieldError, TextField } from "@/ui/text-field.tsx";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export interface HabitFormValues {
	name: string;
	/** Trimmed; empty = none (2.12.0). */
	description: string;
	/** Absent when editing a habit whose repetition this version cannot edit. */
	schedule?: Schedule;
	/** "Começa em" (used when creating). */
	start_date: CalendarDate;
}

/** An existing habit being edited. */
export interface HabitFormInitial {
	/** An edited habit's id: its postponed occurrences (2.16.0). */
	id?: string;
	name: string;
	description?: string;
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

/**
 * "Todo ano": a month calendar like "Começa em", the arrows paging through
 * the months (December → January wraps), without a year (a yearly habit has
 * none, so no weekday header). The shown month is local; a tap picks that
 * month and day.
 */
function YearlyDatePicker({
	month,
	day,
	onChange,
}: {
	month: number;
	day: number;
	onChange: (month: number, day: number) => void;
}) {
	const [shown, setShown] = useState(month);
	// Any year works for paging months; only `month` is used.
	const step = (delta: number) =>
		setShown(addMonths({ year: 2024, month: shown }, delta).month);
	return (
		<MonthDayPicker
			title={capitalizeFirst(MONTH_NAMES[shown - 1] ?? "")}
			days={daysInAnyYear(shown)}
			role="radio"
			selected={(value) => shown === month && value === day}
			onPress={(value) => onChange(shown, clampDayToMonth(shown, value))}
			onPrevious={() => step(-1)}
			onNext={() => step(1)}
		/>
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
	reschedules = NO_RESCHEDULES,
	submitLabel,
	pending = false,
	error,
	nameRef,
	onDirtyChange,
	onSubmit,
}: {
	/** The habit being edited (absent: a new habit). */
	initial?: HabitFormInitial;
	today: CalendarDate;
	timeZone: string;
	/**
	 * The user's postponed occurrences (2.16.0), for an edited habit: the
	 * preview's next date and the notice about the ones a new repetition
	 * leaves without effect. A new habit has none.
	 */
	reschedules?: RescheduleIndex;
	submitLabel: string;
	pending?: boolean;
	/** A failure to save, shown above the button; the typed values stay. */
	error?: string;
	/** The name input, for focusing it when a sheet opens. */
	nameRef?: Ref<TextInput>;
	/**
	 * 2.16.2: whether the fields differ from the ones the form opened with
	 * (core's `isHabitFormDirty`), called only when that changes.
	 */
	onDirtyChange?: (dirty: boolean) => void;
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
	const [description, setDescription] = useState(initial?.description ?? "");
	const [nameError, setNameError] = useState<string>();
	const [descriptionProblem, setDescriptionProblem] = useState<string>();
	const [errors, setErrors] = useState<DraftErrors>({});
	// 2.16.2: the state it opened with, normalized once; a habit changed by a
	// sync while the form is open never moves it.
	const [baseline] = useState(() =>
		normalizeHabitForm({ name, description, draft })
	);
	const dirty = isHabitFormDirty(baseline, { name, description, draft });
	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

	const update = (changes: Partial<HabitDraft>) =>
		setDraft((current) => (current ? { ...current, ...changes } : current));

	const built = draft ? buildFromDraft(draft, { today, editing }) : null;
	// 2.13.0: a task whose due date went by keeps it (read only).
	const lockedDue =
		initial && isDeadlinePast(initial.schedule, today)
			? (draftFromHabit(initial, today)?.due ?? null)
			: null;
	const scheduleOptions = { timeZone, reschedules };
	const preview =
		built?.ok === true
			? previewHabit(
					{
						id: initial?.id,
						schedule: built.schedule,
						start_date: built.start_date,
					},
					today,
					scheduleOptions
				)
			: null;
	// 2.16.0: postponements the new repetition would leave without effect.
	const orphanText =
		initial?.id !== undefined && built?.ok === true
			? orphanNotice(
					orphanedReschedules(
						{
							id: initial.id,
							schedule: initial.schedule,
							start_date: initial.start_date,
						},
						{ schedule: built.schedule, start_date: built.start_date },
						reschedules
					),
					{ schedule: built.schedule, start_date: built.start_date },
					today
				)
			: null;

	const submit = () => {
		// Enter on the keyboard can submit while the button is disabled.
		if (pending) return;
		const parsedName = HabitName.safeParse(name);
		setNameError(parsedName.success ? undefined : "Dê um nome ao hábito.");
		setErrors(built && !built.ok ? built.errors : {});
		const describedBad = descriptionError(description);
		setDescriptionProblem(describedBad ?? undefined);
		if (!parsedName.success || (built && !built.ok) || describedBad) return;
		const trimmed = description.trim();

		const values: HabitFormValues =
			built?.ok === true
				? {
						name: parsedName.data,
						description: trimmed,
						schedule: built.schedule,
						start_date: built.start_date,
					}
				: {
						name: parsedName.data,
						description: trimmed,
						start_date: initial?.start_date ?? today,
					};
		const changesPast =
			initial !== undefined &&
			values.schedule !== undefined &&
			!sameSchedule(initial.schedule, values.schedule) &&
			initial.start_date < today;
		if (!changesPast && orphanText === null) {
			onSubmit(values);
			return;
		}
		Alert.alert(
			"Mudar a repetição?",
			[
				changesPast &&
					"Mudar a repetição recalcula os dias passados do heatmap. Dias já marcados continuam contando.",
				orphanText,
			]
				.filter(Boolean)
				.join("\n\n"),
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
		draft.kind !== "deadline" &&
		(!initial || draft.kind === "interval");

	return (
		<View className="gap-6">
			<TextField
				ref={nameRef}
				label="Qual é o hábito?"
				value={name}
				onChangeText={setName}
				maxLength={120}
				placeholder="Ex.: correr, ler, beber água"
				autoCapitalize="sentences"
				returnKeyType="done"
				// The keyboard's Enter key submits the form.
				onSubmitEditing={submit}
				error={nameError}
			/>
			<View className="gap-1">
				<TextField
					label="Descrição (opcional)"
					value={description}
					onChangeText={setDescription}
					multiline
					textAlignVertical="top"
					maxLength={DESCRIPTION_MAX_LENGTH + 200}
					placeholder="Detalhes, passos, links…"
					hint="Aceita **negrito**, *itálico*, listas com - e links."
					error={descriptionProblem}
					style={{ minHeight: 96 }}
				/>
				{description.length >= DESCRIPTION_COUNTER_FROM ? (
					<Text
						className={`self-end text-xs ${description.trim().length > DESCRIPTION_MAX_LENGTH ? "text-night-danger" : "text-night-muted"}`}
					>
						{description.trim().length} de {DESCRIPTION_MAX_LENGTH}
					</Text>
				) : null}
			</View>

			{draft === null ? (
				<Text className="rounded-md border border-night-border p-3 text-sm text-night-muted">
					{UNSUPPORTED_SCHEDULE_TEXT}. Atualize o app para mudar a repetição;
					aqui você pode renomear ou arquivar o hábito.
				</Text>
			) : (
				<>
					<View className="gap-2">
						<Text className="text-sm font-semibold text-night-foreground">
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
								<Text className="text-sm font-semibold text-night-foreground">
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
								<Text className="text-sm font-semibold text-night-foreground">
									Em quais dias do mês?
								</Text>
								<MonthDayPicker
									title="Dias do mês"
									days={31}
									role="checkbox"
									selected={(day) => draft.monthDays.includes(day)}
									onPress={(day) =>
										update({ monthDays: toggled(draft.monthDays, day) })
									}
								/>
								<Text className="text-xs text-night-muted">
									Nos meses mais curtos, 29, 30 e 31 caem no último dia do mês.
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
						{draft.kind === "deadline" &&
							(lockedDue ? (
								<View className="gap-2">
									<Text className="text-sm font-semibold text-night-foreground">
										Até quando: {formatDayMonthYear(lockedDue)}
									</Text>
									<Text className="text-sm text-night-muted">
										{DEADLINE_LOCKED}
									</Text>
									<FieldError>{errors.due}</FieldError>
								</View>
							) : (
								<DatePicker
									label="Até quando?"
									value={draft.due}
									min={today}
									max={latestDueDate(today)}
									error={errors.due}
									onChange={(due) => update({ due })}
								/>
							))}
						{draft.kind === "yearly" && (
							<>
								<Text className="text-sm font-semibold text-night-foreground">
									Em qual dia do ano?
								</Text>
								<YearlyDatePicker
									month={draft.month}
									day={draft.day}
									onChange={(month, day) => update({ month, day })}
								/>
								{draft.month === 2 && draft.day === 29 ? (
									<Text className="text-xs text-night-muted">
										Em anos não bissextos, vale 28/02.
									</Text>
								) : null}
							</>
						)}
						{draft.kind !== "interval" &&
						draft.kind !== "once" &&
						draft.kind !== "deadline" ? (
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
						className="rounded-md border border-night-border bg-night-bg px-3 py-2"
					>
						{preview ? (
							<>
								<Text className="text-sm text-night-foreground">
									{preview.summary}
								</Text>
								{preview.next ? (
									<Text className="text-sm text-night-muted">
										{preview.next}
									</Text>
								) : null}
							</>
						) : (
							<Text className="text-sm text-night-muted">
								Complete a repetição.
							</Text>
						)}
					</View>
				</>
			)}

			<FieldError>{error}</FieldError>

			<Button label={submitLabel} pending={pending} onPress={submit} />
		</View>
	);
}
