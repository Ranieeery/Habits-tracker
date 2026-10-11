import { HabitName, type Schedule, WeekdaysSchedule } from "@habits/contracts";
import { type FormEvent, useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { weekdayInitial, weekdayName } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export interface HabitFormValues {
	name: string;
	schedule: Schedule;
}

interface Errors {
	name?: string;
	days?: string;
}

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
						className={cn(
							"flex size-touch items-center justify-center rounded-md border-2 text-sm font-bold transition-colors",
							selected
								? "border-violet-500 bg-violet-600 text-foreground"
								: "border-border bg-surface text-muted hover:text-foreground"
						)}
					>
						{weekdayInitial(day)}
					</button>
				);
			})}
		</div>
	);
}

export function HabitForm({
	initial,
	submitLabel,
	pending = false,
	autoFocusName = false,
	error,
	onSubmit,
}: {
	initial?: HabitFormValues;
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
		days: useId(),
		nameError: useId(),
		daysError: useId(),
	};
	const [name, setName] = useState(initial?.name ?? "");
	const [days, setDays] = useState<number[]>(
		initial?.schedule.type === "weekdays" ? initial.schedule.days : []
	);
	const [errors, setErrors] = useState<Errors>({});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const parsedName = HabitName.safeParse(name);
		const parsedSchedule = WeekdaysSchedule.safeParse({
			type: "weekdays",
			days: [...days].sort((a, b) => a - b),
		});
		const next: Errors = {
			name: parsedName.success ? undefined : "Dê um nome ao hábito.",
			days: parsedSchedule.success
				? undefined
				: "Escolha pelo menos um dia da semana.",
		};
		setErrors(next);
		if (parsedName.success && parsedSchedule.success) {
			onSubmit({ name: parsedName.data, schedule: parsedSchedule.data });
		}
	};

	return (
		<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Label htmlFor={ids.name}>Qual é o hábito?</Label>
				<Input
					id={ids.name}
					value={name}
					maxLength={120}
					placeholder="Ex.: exercícios, dormir bem, beber água…"
					autoComplete="off"
					autoFocus={autoFocusName}
					aria-invalid={errors.name ? true : undefined}
					aria-describedby={errors.name ? ids.nameError : undefined}
					onChange={(event) => setName(event.target.value)}
				/>
				<FieldError id={ids.nameError}>{errors.name}</FieldError>
			</div>

			<div className="flex flex-col gap-2">
				<span id={ids.days} className="text-sm font-semibold">
					Em quais dias da semana?
				</span>
				<WeekdayPicker
					value={days}
					onChange={setDays}
					labelledBy={ids.days}
					describedBy={errors.days ? ids.daysError : undefined}
				/>
				<FieldError id={ids.daysError}>{errors.days}</FieldError>
			</div>

			<FieldError>{error}</FieldError>

			<Button type="submit" variant="success" disabled={pending}>
				{pending ? "Salvando…" : submitLabel}
			</Button>
		</form>
	);
}
