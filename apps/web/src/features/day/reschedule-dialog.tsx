import type { CalendarDate, Habit } from "@habits/contracts";
import {
	formatDayMonth,
	rescheduleBounds,
	rescheduleShortcuts,
	rescheduleSummary,
} from "@habits/core";
import { CalendarClockIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { FieldError } from "@/components/states.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import { DateField } from "@/features/habits/date-field.tsx";
import { useToday } from "@/lib/use-today.ts";
import { cn } from "@/lib/utils.ts";
import {
	type OccurrenceTarget,
	rescheduleFailure,
	useRescheduleHabit,
} from "./use-reschedule-habit.ts";

/**
 * "Adiar" (2.16.0): moves one occurrence of a single-date or days-of-month
 * habit to a later date. Quick choices from core (`rescheduleShortcuts`;
 * invalid ones disabled with the reason), "Escolher data" with the habits
 * form's date field limited to the valid range (`rescheduleBounds`), and the
 * effect before confirming (`rescheduleSummary`). A failure keeps the dialog
 * open with what was chosen.
 */
export function RescheduleDialog({
	habit,
	occurrence,
	open,
	onOpenChange,
}: {
	habit: Habit;
	occurrence: OccurrenceTarget;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Adiar {habit.name}</DialogTitle>
					<DialogDescription>
						Só a ocorrência de {formatDayMonth(occurrence.original)}. A
						repetição do hábito não muda.
					</DialogDescription>
				</DialogHeader>
				{open && (
					<RescheduleForm
						key={`${habit.id}:${occurrence.effective}`}
						habit={habit}
						occurrence={occurrence}
						onDone={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function RescheduleForm({
	habit,
	occurrence,
	onDone,
}: {
	habit: Habit;
	occurrence: OccurrenceTarget;
	onDone: () => void;
}) {
	const today = useToday();
	const ids = { group: useId(), summary: useId() };
	const { reschedule, pending } = useRescheduleHabit();
	const bounds = rescheduleBounds(habit, occurrence, today);
	const shortcuts = bounds
		? rescheduleShortcuts(occurrence.effective, today, bounds)
		: [];
	const firstValid = shortcuts.find((choice) => !choice.disabledReason);
	const [choice, setChoice] = useState<CalendarDate | "pick">(
		firstValid?.date ?? "pick"
	);
	const [picked, setPicked] = useState<CalendarDate | "">("");
	const [error, setError] = useState<string>();
	const to = choice === "pick" ? picked : choice;
	const summary =
		to === ""
			? null
			: rescheduleSummary({
					effective: occurrence.effective,
					to,
					count: occurrence.count,
					today,
				});

	if (!bounds) {
		return (
			<p className="text-sm text-night-muted">
				Não há data possível antes da próxima ocorrência.
			</p>
		);
	}

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (to === "" || pending) return;
		setError(undefined);
		try {
			await reschedule({ habit, occurrence, to });
			onDone();
		} catch (failure) {
			setError(rescheduleFailure(failure, today));
		}
	};

	const optionClass = (selected: boolean, disabled: boolean) =>
		cn(
			"flex min-h-touch w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left motion-safe:transition-colors motion-safe:duration-150",
			disabled
				? "cursor-not-allowed border-night-border text-night-subtle"
				: selected
					? "border-night-accent bg-night-accent/15 text-night-foreground"
					: "border-night-border-strong hover:bg-night-surface-raised"
		);

	return (
		<form noValidate onSubmit={submit} className="flex flex-col gap-5">
			<div
				role="group"
				aria-labelledby={ids.group}
				className="flex flex-col gap-2"
			>
				<span id={ids.group} className="text-sm font-medium">
					Para quando?
				</span>
				{shortcuts.map((shortcut) => {
					const disabled = shortcut.disabledReason !== null;
					const selected = choice === shortcut.date;
					return (
						<button
							key={shortcut.label}
							type="button"
							aria-pressed={selected}
							aria-disabled={disabled || undefined}
							autoFocus={shortcut === firstValid}
							onClick={() => {
								if (!disabled) setChoice(shortcut.date);
							}}
							className={optionClass(selected, disabled)}
						>
							<span className="flex flex-col">
								<span className="font-medium">{shortcut.label}</span>
								{shortcut.disabledReason && (
									<span className="text-xs text-night-muted">
										{shortcut.disabledReason}
									</span>
								)}
							</span>
							<span className="text-sm text-night-muted tabular-nums">
								{formatDayMonth(shortcut.date, today)}
							</span>
						</button>
					);
				})}
				<button
					type="button"
					aria-pressed={choice === "pick"}
					autoFocus={firstValid === undefined}
					onClick={() => setChoice("pick")}
					className={optionClass(choice === "pick", false)}
				>
					<span className="font-medium">Escolher data</span>
					<CalendarClockIcon
						className="size-4 text-night-muted"
						aria-hidden="true"
					/>
				</button>
				{choice === "pick" && (
					<DateField
						label="Nova data"
						value={picked}
						min={bounds.min}
						max={bounds.max}
						onChange={setPicked}
					/>
				)}
			</div>

			<p
				id={ids.summary}
				aria-live="polite"
				className="rounded-md border border-night-border bg-night-bg px-3 py-2 text-sm"
			>
				{summary ? (
					<>
						{summary.effect}
						<span
							className={cn(
								"block",
								summary.last ? "text-night-warning" : "text-night-muted"
							)}
						>
							{summary.remaining}
						</span>
					</>
				) : (
					<span className="text-night-muted">Escolha a nova data.</span>
				)}
			</p>

			<FieldError>{error}</FieldError>

			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button
					type="submit"
					disabled={to === "" || pending}
					aria-describedby={ids.summary}
				>
					{pending ? "Adiando…" : "Adiar"}
				</Button>
			</div>
		</form>
	);
}
