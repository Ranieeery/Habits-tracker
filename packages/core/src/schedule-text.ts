// pt-BR text derived from schedules, shared by the web and the mobile app (like
// `reminderMessage`). Pure: no dayjs or Intl, so both clients get the same words.
import { isSupportedSchedule, type StoredSchedule } from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	parseCalendarDate,
	weekdayOf,
} from "./dates.ts";
import {
	isHabitPossibleOn,
	nextOccurrence,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";

/** Short pt-BR weekday names, Sunday = 0. */
export const WEEKDAY_SHORT_NAMES = [
	"dom",
	"seg",
	"ter",
	"qua",
	"qui",
	"sex",
	"sáb",
] as const;

/** Shown for a schedule type this build does not understand. */
export const UNSUPPORTED_SCHEDULE_TEXT = "Repetição não suportada nesta versão";

/** Distinct weekdays, Sunday first; values outside 0-6 are dropped. */
function sortedWeekdays(days: readonly number[]): number[] {
	return [...new Set(days)]
		.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
		.sort((a, b) => a - b);
}

/** "seg, qua, sex": every chosen weekday, Sunday first. */
export function listWeekdays(days: readonly number[]): string {
	return sortedWeekdays(days)
		.map((day) => WEEKDAY_SHORT_NAMES[day])
		.join(", ");
}

/** "Todos os dias", "Dias úteis", "Fins de semana", or "seg, qua, sex". */
export function formatWeekdays(days: readonly number[]): string {
	const key = sortedWeekdays(days).join();
	if (key === "0,1,2,3,4,5,6") return "Todos os dias";
	if (key === "1,2,3,4,5") return "Dias úteis";
	if (key === "0,6") return "Fins de semana";
	return listWeekdays(days);
}

/** "a", "a e b", "a, b e c". */
function joinWithAnd(items: readonly string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** "20/11", or "20/11/2027" when `today` is given and the year differs. */
export function formatDayMonth(
	date: CalendarDate,
	today?: CalendarDate
): string {
	const { year, month, day } = parseCalendarDate(date);
	const short = `${pad(day)}/${pad(month)}`;
	if (today !== undefined && parseCalendarDate(today).year !== year) {
		return `${short}/${year}`;
	}
	return short;
}

/** "20/11/2026": a full pt-BR date (day first, never the US order). */
export function formatDayMonthYear(date: CalendarDate): string {
	const { year, month, day } = parseCalendarDate(date);
	return `${pad(day)}/${pad(month)}/${year}`;
}

/** "hoje", "amanhã", or "sex, 20/11" (with the year when it differs). */
export function formatRelativeDate(
	date: CalendarDate,
	today: CalendarDate
): string {
	if (date === today) return "hoje";
	if (date === addDays(today, 1)) return "amanhã";
	return `${WEEKDAY_SHORT_NAMES[weekdayOf(date)]}, ${formatDayMonth(date, today)}`;
}

/** "Todo dia 20", "Todo dia 5 e 20". */
function monthlyDaysText(days: readonly number[]): string {
	const sorted = [...new Set(days)].sort((a, b) => a - b).map(String);
	return `Todo dia ${joinWithAnd(sorted)}`;
}

function yearlyText(month: number, day: number): string {
	const base = `Todo ano em ${pad(day)}/${pad(month)}`;
	return month === 2 && day === 29
		? `${base} (28/02 em anos não bissextos)`
		: base;
}

/**
 * Short label of a schedule, for lists: "Dias úteis", "A cada 8 dias",
 * "Todo dia 20", "Todo ano em 20/11", "Dia 20/11" (with the year when it is
 * not `today`'s), or `UNSUPPORTED_SCHEDULE_TEXT`.
 */
export function formatSchedule(
	schedule: StoredSchedule,
	{ today }: { today?: CalendarDate } = {}
): string {
	if (!isSupportedSchedule(schedule)) return UNSUPPORTED_SCHEDULE_TEXT;
	switch (schedule.type) {
		case "weekdays":
			return formatWeekdays(schedule.days);
		case "interval":
			return schedule.every === 1
				? "Todos os dias"
				: `A cada ${schedule.every} dias`;
		case "monthly_days":
			return monthlyDaysText(schedule.days);
		case "once":
			return `Dia ${formatDayMonth(schedule.date, today)}`;
		case "yearly":
			return yearlyText(schedule.month, schedule.day);
		case "deadline":
			return `Até ${formatDayMonth(schedule.due_date, today)}`;
		default: {
			const unknown: never = schedule;
			throw new Error(`Unknown schedule type: ${String(unknown)}`);
		}
	}
}

/**
 * A sentence for the habit form: "Repete a cada 8 dias, a partir de 22/10",
 * "Repete em seg, qua", "Uma vez, dia 20/11". The start date is mentioned
 * only when it is after `today`.
 */
export function repeatSummary(
	habit: { schedule: StoredSchedule; start_date: CalendarDate },
	today: CalendarDate
): string {
	const { schedule, start_date } = habit;
	if (!isSupportedSchedule(schedule)) return UNSUPPORTED_SCHEDULE_TEXT;
	if (schedule.type === "once") {
		return `Uma vez, dia ${formatDayMonth(schedule.date, today)}`;
	}
	if (schedule.type === "deadline") {
		return `Pode ser concluído até ${formatDayMonth(schedule.due_date, today)}. Se passar do prazo, fica atrasado.`;
	}
	let text: string;
	if (schedule.type === "weekdays") {
		const label = formatWeekdays(schedule.days);
		text =
			label === "Todos os dias"
				? "Repete todos os dias"
				: label === "Dias úteis"
					? "Repete em dias úteis"
					: label === "Fins de semana"
						? "Repete nos fins de semana"
						: `Repete em ${label}`;
	} else {
		const label = formatSchedule(schedule, { today });
		text = `Repete ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
	}
	return start_date > today
		? `${text}, a partir de ${formatDayMonth(start_date, today)}`
		: text;
}

/**
 * What to tell the user after creating a habit from a day view: null when the
 * habit counts on `today` (it shows up in the list, nothing to explain),
 * otherwise "Hábito criado. Aparece em: seg, qua" for weekday habits, or
 * "Hábito criado. Próxima vez: sex, 20/11" for the other schedules.
 */
export function newHabitNotice(
	habit: SchedulableHabit,
	today: CalendarDate,
	options: TimeZoneOptions
): string | null {
	if (isHabitPossibleOn(habit, today, options)) return null;
	const { schedule } = habit;
	// A task started by today shows in "Com prazo" (2.13.0).
	if (
		isSupportedSchedule(schedule) &&
		schedule.type === "deadline" &&
		habit.start_date <= today &&
		schedule.due_date >= today
	) {
		return null;
	}
	if (isSupportedSchedule(schedule) && schedule.type === "weekdays") {
		return `Hábito criado. Aparece em: ${listWeekdays(schedule.days)}`;
	}
	const next = nextOccurrence(habit, today, options);
	return next === null
		? "Hábito criado."
		: `Hábito criado. Próxima vez: ${formatRelativeDate(next, today)}`;
}
