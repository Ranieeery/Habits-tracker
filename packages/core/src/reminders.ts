// Daily reminder decision. Pure: the current instant, the time zone and the
// user's state are parameters (the cron passes its scheduled time).
import type { CalendarDate } from "./dates.ts";
import { todayIn } from "./window.ts";

/** Local wall-clock time, `HH:MM` (24h). */
export type LocalTime = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

/** The local `HH:MM` of a UTC instant (ms) in an IANA time zone. */
export function localTimeAt(instantMs: number, timeZone: string): LocalTime {
	const parts = timeFormatterFor(timeZone).formatToParts(instantMs);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "00";
	// Some runtimes print midnight as "24" even with h23.
	const hour = get("hour") === "24" ? "00" : get("hour");
	return `${hour.padStart(2, "0")}:${get("minute").padStart(2, "0")}`;
}

export interface ReminderTimingInput {
	/** Current instant in UTC ms (the cron's scheduled time). */
	nowMs: number;
	/** The user's IANA time zone (`user_settings.timezone`). */
	timeZone: string;
	/** `HH:MM` in `timeZone`; null means reminders are off. */
	reminderTime: LocalTime | null;
	/** Local date of the last reminder sent (or claimed), if any. */
	lastReminderDate: CalendarDate | null;
}

export interface ReminderDue {
	due: boolean;
	/** The user's local date at `nowMs`. */
	today: CalendarDate;
}

/**
 * Whether today's reminder is due by time alone: reminders are on, the local
 * time reached `reminderTime`, and none was sent today. A time skipped by a
 * DST jump still fires, since the check is "already passed".
 */
export function isReminderDue({
	nowMs,
	timeZone,
	reminderTime,
	lastReminderDate,
}: ReminderTimingInput): ReminderDue {
	const today = todayIn(timeZone, nowMs);
	if (reminderTime === null) return { due: false, today };
	if (lastReminderDate !== null && lastReminderDate >= today) {
		return { due: false, today };
	}
	return { due: localTimeAt(nowMs, timeZone) >= reminderTime, today };
}

export interface ShouldSendReminderInput extends ReminderTimingInput {
	/** Habits possible today and not completed yet. */
	pendingCount: number;
}

/**
 * At most one reminder per local day, only after `reminderTime` in the user's
 * time zone, only with pending habits, never when reminders are off.
 */
export function shouldSendReminder(input: ShouldSendReminderInput): boolean {
	return input.pendingCount > 0 && isReminderDue(input).due;
}

export interface ReminderMessage {
	title: string;
	body: string;
}

/** pt-BR text with the count only: habit names never reach the lock screen. */
export function reminderMessage(pendingCount: number): ReminderMessage {
	const habits = pendingCount === 1 ? "hábito pendente" : "hábitos pendentes";
	return {
		title: "Habits",
		body: `Você tem ${pendingCount} ${habits} hoje.`,
	};
}
