import {
	type CalendarDate,
	DESCRIPTION_MAX_LENGTH,
	HabitName,
	type Schedule,
	type StoredSchedule,
} from "@habits/contracts";
import {
	buildFromDraft,
	DEADLINE_LOCKED,
	DESCRIPTION_COUNTER_FROM,
	descriptionError,
	type DraftErrors,
	draftFromHabit,
	emptyDraft,
	formatDayMonthYear,
	type HabitDraft,
	isDeadlinePast,
	latestDueDate,
	MONTH_NAMES,
	previewHabit,
	REPEAT_KINDS,
	type RepeatKind,
	UNSUPPORTED_SCHEDULE_TEXT,
} from "@habits/core";
import { type FormEvent, useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select } from "@/components/ui/select.tsx";
import { weekdayInitial, weekdayName } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { DateField } from "./date-field.tsx";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

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
	name: string;
	description?: string;
	schedule: StoredSchedule;
	start_date: CalendarDate;
}

const toggleClass = (selected: boolean) =>
	cn(
		"flex items-center justify-center rounded-md border-2 text-sm font-bold transition-colors",
		selected
			? "border-night-accent bg-night-accent text-night-accent-on"
			: "border-night-border-strong bg-night-bg text-night-muted hover:border-night-subtle hover:text-night-foreground"
	);

/** Sunday = 0 ... Saturday = 6, as toggle buttons. */
export function WeekdayPicker({
	value,
	onChange,
	labelledBy,
	describedBy,
}: {
	value: number[];
	onChange: (days: number[]) => void;
	labelledBy: string;
	describedBy?: string;
}) {
	const toggle = (day: number) =>
		onChange(
			value.includes(day)
				? value.filter((d) => d !== day)
				: [...value, day].sort((a, b) => a - b)
		);

	return (
		<div
			role="group"
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			className="flex flex-wrap gap-2"
		>
			{WEEKDAYS.map((day) => {
				const selected = value.includes(day);
				return (
					<button
						key={day}
						type="button"
						aria-pressed={selected}
						aria-label={weekdayName(day)}
						title={weekdayName(day)}
						onClick={() => toggle(day)}
						className={cn("size-touch", toggleClass(selected))}
					>
						{weekdayInitial(day)}
					</button>
				);
			})}
		</div>
	);
}

/** Days 1-31 of the month, as toggle buttons in a 7-column grid. */
function MonthDayPicker({
	value,
	onChange,
	labelledBy,
	describedBy,
}: {
	value: number[];
	onChange: (days: number[]) => void;
	labelledBy: string;
	describedBy?: string;
}) {
	return (
		<div
			role="group"
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			className="grid grid-cols-7 gap-1"
		>
			{MONTH_DAYS.map((day) => {
				const selected = value.includes(day);
				return (
					<button
						key={day}
						type="button"
						aria-pressed={selected}
						aria-label={`Dia ${day}`}
						onClick={() =>
							onChange(
								selected
									? value.filter((d) => d !== day)
									: [...value, day].sort((a, b) => a - b)
							)
						}
						className={cn("min-h-touch", toggleClass(selected))}
					>
						{day}
					</button>
				);
			})}
		</div>
	);
}

function RepeatKindPicker({
	value,
	onChange,
	labelledBy,
}: {
	value: RepeatKind;
	onChange: (kind: RepeatKind) => void;
	labelledBy: string;
}) {
	return (
		<div
			role="radiogroup"
			aria-labelledby={labelledBy}
			className="flex flex-wrap gap-2"
		>
			{REPEAT_KINDS.map(({ kind, label }) => (
				<button
					key={kind}
					type="button"
					role="radio"
					aria-checked={value === kind}
					onClick={() => onChange(kind)}
					className={cn("min-h-touch px-3", toggleClass(value === kind))}
				>
					{label}
				</button>
			))}
		</div>
	);
}

function sameSchedule(a: StoredSchedule, b: Schedule): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The habit form (habits screen and today's dialog): name and repetition.
 * Validation, the schedule built from the fields and the preview all come
 * from `@habits/core`. Editing the repetition of a habit that already started
 * asks for confirmation first (past heatmap days are recalculated).
 */
export function HabitForm({
	initial,
	today,
	timeZone,
	submitLabel,
	pending = false,
	autoFocusName = false,
	error,
	onSubmit,
}: {
	/** The habit being edited (absent: a new habit). */
	initial?: HabitFormInitial;
	today: CalendarDate;
	timeZone: string;
	submitLabel: string;
	pending?: boolean;
	/** Focus the name when the form appears (dialogs opened for creating). */
	autoFocusName?: boolean;
	/** A failure to save, shown above the button; the typed values stay. */
	error?: string;
	onSubmit: (values: HabitFormValues) => void;
}) {
	const ids = {
		name: useId(),
		nameError: useId(),
		description: useId(),
		descriptionHint: useId(),
		kind: useId(),
		field: useId(),
		fieldError: useId(),
		startError: useId(),
		preview: useId(),
	};
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
	const [confirming, setConfirming] = useState<HabitFormValues | null>(null);

	const update = (changes: Partial<HabitDraft>) => {
		setConfirming(null);
		setDraft((current) => (current ? { ...current, ...changes } : current));
	};

	const built = draft ? buildFromDraft(draft, { today, editing }) : null;
	const preview =
		built?.ok === true
			? previewHabit(
					{ schedule: built.schedule, start_date: built.start_date },
					today,
					{ timeZone }
				)
			: null;

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (confirming) {
			onSubmit(confirming);
			return;
		}
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
		const reschedules =
			initial !== undefined &&
			values.schedule !== undefined &&
			!sameSchedule(initial.schedule, values.schedule) &&
			initial.start_date < today;
		if (reschedules) setConfirming(values);
		else onSubmit(values);
	};

	const fieldError = (key: keyof DraftErrors) =>
		errors[key] ? ids.fieldError : undefined;
	const kindError = draft
		? (errors.weekdays ??
			errors.every ??
			errors.monthDays ??
			errors.date ??
			errors.day ??
			errors.due)
		: undefined;
	// 2.13.0: a task whose due date went by keeps it (read only).
	const lockedDue =
		initial && isDeadlinePast(initial.schedule, today)
			? (draftFromHabit(initial, today)?.due ?? null)
			: null;
	// "Começa em": new habits (except single dates) and the interval's anchor.
	const showStart =
		draft !== null &&
		draft.kind !== "once" &&
		draft.kind !== "deadline" &&
		(!initial || draft.kind === "interval");

	return (
		<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Label htmlFor={ids.name}>Qual é o hábito?</Label>
				<Input
					id={ids.name}
					value={name}
					maxLength={120}
					placeholder="Ex.: exercícios, consulta, pagar condomínio…"
					autoComplete="off"
					autoFocus={autoFocusName}
					aria-invalid={nameError ? true : undefined}
					aria-describedby={nameError ? ids.nameError : undefined}
					onChange={(event) => setName(event.target.value)}
				/>
				<FieldError id={ids.nameError}>{nameError}</FieldError>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor={ids.description}>Descrição (opcional)</Label>
				<Textarea
					id={ids.description}
					value={description}
					rows={3}
					placeholder="Detalhes, passos, links…"
					aria-invalid={descriptionProblem ? true : undefined}
					aria-describedby={ids.descriptionHint}
					onChange={(event) => setDescription(event.target.value)}
				/>
				<div
					id={ids.descriptionHint}
					className="flex justify-between gap-3 text-sm text-night-muted"
				>
					<span>Aceita **negrito**, *itálico*, listas com - e links.</span>
					{description.length >= DESCRIPTION_COUNTER_FROM && (
						<span
							className={cn(
								"shrink-0 tabular-nums",
								description.trim().length > DESCRIPTION_MAX_LENGTH &&
									"text-night-danger"
							)}
						>
							{description.trim().length} de {DESCRIPTION_MAX_LENGTH}
						</span>
					)}
				</div>
				<FieldError>{descriptionProblem}</FieldError>
			</div>

			{draft === null ? (
				<p className="rounded-md border border-night-border p-3 text-sm text-night-muted">
					{UNSUPPORTED_SCHEDULE_TEXT}. Atualize o app para mudar a repetição;
					aqui você pode renomear o hábito.
				</p>
			) : (
				<>
					<div className="flex flex-col gap-2">
						<span id={ids.kind} className="text-sm font-semibold">
							Repetição
						</span>
						<RepeatKindPicker
							value={draft.kind}
							onChange={(kind) => update({ kind })}
							labelledBy={ids.kind}
						/>
					</div>

					<div className="flex flex-col gap-2">
						{draft.kind === "weekdays" && (
							<>
								<span id={ids.field} className="text-sm font-semibold">
									Em quais dias da semana?
								</span>
								<WeekdayPicker
									value={draft.weekdays}
									onChange={(weekdays) => update({ weekdays })}
									labelledBy={ids.field}
									describedBy={fieldError("weekdays")}
								/>
							</>
						)}
						{draft.kind === "interval" && (
							<>
								<Label htmlFor={ids.field}>A cada quantos dias?</Label>
								<Input
									id={ids.field}
									type="number"
									inputMode="numeric"
									min={1}
									max={366}
									className="w-32"
									value={draft.every}
									aria-invalid={errors.every ? true : undefined}
									aria-describedby={fieldError("every")}
									onChange={(event) => update({ every: event.target.value })}
								/>
							</>
						)}
						{draft.kind === "monthly_days" && (
							<>
								<span id={ids.field} className="text-sm font-semibold">
									Em quais dias do mês?
								</span>
								<MonthDayPicker
									value={draft.monthDays}
									onChange={(monthDays) => update({ monthDays })}
									labelledBy={ids.field}
									describedBy={fieldError("monthDays")}
								/>
								<p className="text-xs text-night-subtle">
									Em meses sem o dia escolhido (como 31 ou 30 em fevereiro),
									vale o último dia do mês.
								</p>
							</>
						)}
						{draft.kind === "once" && (
							<DateField
								label="Em qual data?"
								value={draft.date}
								min={
									initial && initial.start_date > today
										? initial.start_date
										: today
								}
								invalid={Boolean(errors.date)}
								describedBy={fieldError("date")}
								onChange={(date) => update({ date })}
							/>
						)}
						{draft.kind === "deadline" &&
							(lockedDue ? (
								<div className="flex flex-col gap-1">
									<p className="text-sm font-semibold">
										Até quando: {formatDayMonthYear(lockedDue)}
									</p>
									<p className="text-sm text-night-muted">{DEADLINE_LOCKED}</p>
								</div>
							) : (
								<DateField
									label="Até quando?"
									value={draft.due}
									min={today}
									max={latestDueDate(today)}
									invalid={Boolean(errors.due)}
									describedBy={fieldError("due")}
									onChange={(due) => update({ due })}
								/>
							))}
						{draft.kind === "yearly" && (
							<fieldset className="flex flex-col gap-2">
								<legend className="text-sm font-semibold">
									Em qual dia do ano?
								</legend>
								<div className="flex flex-wrap gap-2">
									<Select
										aria-label="Dia"
										value={draft.day}
										aria-invalid={errors.day ? true : undefined}
										aria-describedby={fieldError("day")}
										onChange={(event) =>
											update({ day: Number(event.target.value) })
										}
									>
										{MONTH_DAYS.map((day) => (
											<option key={day} value={day}>
												{day}
											</option>
										))}
									</Select>
									<Select
										aria-label="Mês"
										value={draft.month}
										onChange={(event) =>
											update({ month: Number(event.target.value) })
										}
									>
										{MONTH_NAMES.map((month, index) => (
											<option key={month} value={index + 1}>
												{month}
											</option>
										))}
									</Select>
								</div>
								{draft.month === 2 && draft.day === 29 && (
									<p className="text-xs text-night-subtle">
										Em anos não bissextos, vale 28/02.
									</p>
								)}
							</fieldset>
						)}
						<FieldError id={ids.fieldError}>{kindError}</FieldError>
					</div>

					{showStart && (
						<div className="flex flex-col gap-2">
							<DateField
								label="Começa em"
								value={draft.start}
								min={today}
								invalid={Boolean(errors.start)}
								describedBy={errors.start ? ids.startError : undefined}
								onChange={(start) => update({ start })}
							/>
							<FieldError id={ids.startError}>{errors.start}</FieldError>
						</div>
					)}

					<p
						id={ids.preview}
						aria-live="polite"
						className="rounded-md border border-night-border bg-night-bg px-3 py-2 text-sm"
					>
						{preview ? (
							<>
								{preview.summary}
								{preview.next && (
									<span className="block text-night-muted">{preview.next}</span>
								)}
							</>
						) : (
							<span className="text-night-muted">Complete a repetição.</span>
						)}
					</p>
				</>
			)}

			<FieldError>{error}</FieldError>

			{confirming && (
				<p
					role="alert"
					className="rounded-md border border-night-warning/50 bg-night-warning-surface px-3 py-2 text-sm text-night-warning"
				>
					Mudar a repetição recalcula os dias passados do heatmap. Dias já
					marcados continuam contando.
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				{confirming && (
					<Button
						type="button"
						variant="outline"
						onClick={() => setConfirming(null)}
					>
						Cancelar
					</Button>
				)}
				<Button type="submit" variant="default" disabled={pending}>
					{pending
						? "Salvando…"
						: confirming
							? "Salvar mesmo assim"
							: submitLabel}
				</Button>
			</div>
		</form>
	);
}
