// pt-BR text derived from schedules, shared by the web and the mobile app (like
// `reminderMessage`). Pure: no dayjs or Intl, so both clients get the same words.
import type { Schedule } from "@habits/contracts";
import type { CalendarDate } from "./dates.ts";
import {
	isHabitPossibleOn,
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

/** The days a schedule recurs on, in words for a sentence ("seg, qua"). */
function scheduleDays(schedule: Schedule): string {
	switch (schedule.type) {
		case "weekdays":
			return listWeekdays(schedule.days);
		default: {
			const unknown: never = schedule.type;
			throw new Error(`Unknown schedule type: ${String(unknown)}`);
		}
	}
}

/**
 * What to tell the user after creating a habit from a day view: null when the
 * habit counts on `today` (it shows up in the list, nothing to explain),
 * otherwise "Hábito criado. Aparece em: seg, qua", so it does not look lost.
 */
export function newHabitNotice(
	habit: SchedulableHabit,
	today: CalendarDate,
	options: TimeZoneOptions
): string | null {
	if (isHabitPossibleOn(habit, today, options)) return null;
	return `Hábito criado. Aparece em: ${scheduleDays(habit.schedule)}`;
}
