import type { CalendarDate } from "@habits/contracts";
import {
	addMonths,
	formatDayMonthYear,
	isMonthBefore,
	monthGrid,
	monthOf,
	monthTitle,
	WEEKDAY_SHORT_NAMES,
} from "@habits/core";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { weekdayName } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

/**
 * A date as "dd/mm/aaaa" with a month calendar in a popover. Not
 * `<input type="date">`: browsers draw it in their own UI language (mm/dd/yyyy
 * in an English browser), whatever the page's `lang`. Days before `min` are
 * disabled; the calendar logic comes from @habits/core (shared with mobile).
 */
const monthIndex = ({ year, month }: { year: number; month: number }) =>
	year * 12 + month;

export function DateField({
	label,
	value,
	min,
	max,
	invalid = false,
	describedBy,
	onChange,
}: {
	label: string;
	value: CalendarDate | "";
	min: CalendarDate;
	/** Latest date that can be picked (2.13.0: a task's due date). */
	max?: CalendarDate;
	invalid?: boolean;
	describedBy?: string;
	onChange: (date: CalendarDate) => void;
}) {
	const ids = { label: useId(), trigger: useId(), title: useId() };
	const [open, setOpen] = useState(false);
	const [shown, setShown] = useState(() => monthOf(value || min));
	const previous = addMonths(shown, -1);

	const onOpenChange = (next: boolean) => {
		if (next) setShown(monthOf(value || min));
		setOpen(next);
	};

	return (
		<div className="flex flex-col gap-2">
			<span id={ids.label} className="text-sm font-semibold">
				{label}
			</span>
			<Popover open={open} onOpenChange={onOpenChange}>
				<PopoverTrigger asChild>
					<button
						id={ids.trigger}
						type="button"
						aria-labelledby={`${ids.label} ${ids.trigger}`}
						aria-describedby={describedBy}
						aria-invalid={invalid ? true : undefined}
						className={cn(
							"flex min-h-touch w-48 items-center justify-between gap-2 rounded-md border bg-night-bg px-4 text-base text-night-foreground transition-colors hover:border-night-subtle",
							invalid ? "border-night-danger" : "border-night-border-strong"
						)}
					>
						<span
							className={
								value ? "tabular-nums" : "text-night-subtle tabular-nums"
							}
						>
							{value ? formatDayMonthYear(value) : "dd/mm/aaaa"}
						</span>
						<CalendarIcon
							className="size-4 text-night-muted"
							aria-hidden="true"
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent aria-labelledby={ids.title} className="w-80">
					<div className="flex items-center justify-between">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Mês anterior"
							disabled={isMonthBefore(previous, min)}
							onClick={() => setShown(previous)}
						>
							<ChevronLeftIcon aria-hidden="true" />
						</Button>
						<span
							id={ids.title}
							aria-live="polite"
							className="font-display font-semibold first-letter:uppercase"
						>
							{monthTitle(shown)}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Próximo mês"
							disabled={
								max !== undefined &&
								monthIndex(addMonths(shown, 1)) > monthIndex(monthOf(max))
							}
							onClick={() => setShown(addMonths(shown, 1))}
						>
							<ChevronRightIcon aria-hidden="true" />
						</Button>
					</div>
					<table className="w-full border-collapse" role="grid">
						<thead>
							<tr>
								{WEEKDAY_SHORT_NAMES.map((name, day) => (
									<th
										key={name}
										scope="col"
										abbr={weekdayName(day)}
										className="pb-1 text-xs font-semibold text-night-subtle"
									>
										{name.charAt(0).toUpperCase()}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{monthGrid(shown).map((week, index) => (
								<tr key={index}>
									{week.map((date, day) => (
										<td key={date ?? `empty-${day}`} className="p-0.5">
											{date && (
												<button
													type="button"
													aria-label={formatDayMonthYear(date)}
													aria-pressed={date === value}
													disabled={
														date < min || (max !== undefined && date > max)
													}
													onClick={() => {
														onChange(date);
														setOpen(false);
													}}
													className={cn(
														"flex size-touch w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-night-subtle disabled:opacity-50",
														date === value
															? "bg-night-accent font-bold text-night-accent-on"
															: "hover:bg-night-surface-raised"
													)}
												>
													{Number(date.slice(8))}
												</button>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</PopoverContent>
			</Popover>
		</div>
	);
}
