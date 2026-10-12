import { addDays, type CalendarDate } from "./dates.ts";
import { BACKFILL_DAYS } from "./window.ts";

/**
 * How the day view may edit a date (2.3.0):
 * - `today`: editable, no confirmation.
 * - `past_editable`: from `today - backfillDays` to yesterday; read-only
 *   until the user confirms "Editar este dia".
 * - `past_locked`: older than that; read-only, nothing to unlock.
 * - `future`: read-only (tomorrow too, although the server accepts it: that
 *   extra day only covers a client clock just past midnight).
 */
export type DayEditState = "today" | "past_editable" | "past_locked" | "future";

/**
 * The edit state of `date`. `today` comes from `todayIn(timeZone, nowMs)`, so
 * the user's time zone decides when a day leaves the window.
 */
export function getDayEditState(
	date: CalendarDate,
	today: CalendarDate,
	backfillDays: number = BACKFILL_DAYS
): DayEditState {
	if (date === today) return "today";
	if (date > today) return "future";
	return date >= addDays(today, -backfillDays)
		? "past_editable"
		: "past_locked";
}

/** Whether the checkboxes work: today, or a past day the user unlocked. */
export function isDayEditable(state: DayEditState, unlocked: boolean): boolean {
	return state === "today" || (state === "past_editable" && unlocked);
}
