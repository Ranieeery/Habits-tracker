// Morning digest: one push a day at the fixed MORNING_DIGEST_TIME in the
// user's time zone, with today's non-weekday habits and tomorrow's single
// dates. Pure: the instant, time zone, habits, completions, settings and the
// last sent date are parameters (the cron passes its scheduled time).
import {
	type Completion,
	type Habit,
	isSupportedSchedule,
} from "@habits/contracts";
import { addDays, type CalendarDate } from "./dates.ts";
import { isWithinSendWindow, type LocalTime } from "./reminders.ts";
import {
	isHabitCountedOn,
	isHabitPossibleOn,
	type SchedulableHabit,
	type TimeZoneOptions,
} from "./schedule.ts";
import { todayIn } from "./window.ts";

/** Fixed time of the morning digest, in the user's time zone. */
export const MORNING_DIGEST_TIME: LocalTime = "09:00";

/**
 * How late the digest may still go out (the cron runs every 15 minutes and
 * can be delayed): from 09:00 to 11:59, never after the day turns.
 */
export const DIGEST_GRACE_MINUTES = 180;

/** Body limit of `PushNotificationPayload`. */
const MAX_BODY = 240;

type DigestHabit = SchedulableHabit & Pick<Habit, "id" | "name">;
type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

export interface DigestContent {
	/** Habits that count today (`isHabitCountedOn`). */
	todayTotal: number;
	/** Of those, the ones not completed yet. */
	todayPending: number;
	/** Names of today's pending habits whose schedule is not `weekdays`. */
	highlights: string[];
	/** Names of single-date habits happening tomorrow. */
	tomorrow: string[];
}

/** What the digest of `today` would say. */
export function selectDigestContent(
	habits: readonly DigestHabit[],
	completions: readonly CompletionFacts[],
	today: CalendarDate,
	options: TimeZoneOptions
): DigestContent {
	const done = new Set(
		completions
			.filter((c) => c.date === today && c.deleted_at === null)
			.map((c) => c.habit_id)
	);
	const tomorrowDate = addDays(today, 1);
	const content: DigestContent = {
		todayTotal: 0,
		todayPending: 0,
		highlights: [],
		tomorrow: [],
	};
	for (const habit of habits) {
		const isDone = done.has(habit.id);
		const supported = isSupportedSchedule(habit.schedule)
			? habit.schedule
			: null;
		if (isHabitCountedOn(habit, today, isDone, options)) {
			content.todayTotal += 1;
			if (!isDone) {
				content.todayPending += 1;
				if (supported && supported.type !== "weekdays") {
					content.highlights.push(habit.name);
				}
			}
		}
		if (
			supported?.type === "once" &&
			isHabitPossibleOn(habit, tomorrowDate, options)
		) {
			content.tomorrow.push(habit.name);
		}
	}
	return content;
}

export interface DigestTimingInput {
	/** Current instant in UTC ms (the cron's scheduled time). */
	nowMs: number;
	/** The user's IANA time zone. */
	timeZone: string;
	/** `user_settings.morning_digest_enabled`. */
	enabled: boolean;
	/** Local date of the last digest sent (or claimed), if any. */
	lastDigestDate: CalendarDate | null;
}

export interface DigestDue {
	due: boolean;
	/** The user's local date at `nowMs`. */
	today: CalendarDate;
}

/**
 * Whether today's digest is due by time alone (no data needed, so the cron
 * checks it before reading anything): on, inside the window after
 * `MORNING_DIGEST_TIME`, and not sent today.
 */
export function isDigestDue({
	nowMs,
	timeZone,
	enabled,
	lastDigestDate,
}: DigestTimingInput): DigestDue {
	const today = todayIn(timeZone, nowMs);
	if (!enabled) return { due: false, today };
	if (lastDigestDate !== null && lastDigestDate >= today) {
		return { due: false, today };
	}
	return {
		due: isWithinSendWindow({
			nowMs,
			timeZone,
			time: MORNING_DIGEST_TIME,
			graceMinutes: DIGEST_GRACE_MINUTES,
		}),
		today,
	};
}

export interface ShouldSendDigestInput extends DigestTimingInput {
	content: DigestContent;
}

/**
 * At most one digest per local day, inside its window, only when something
 * is still pending today or a single-date habit happens tomorrow.
 */
export function shouldSendMorningDigest(input: ShouldSendDigestInput): boolean {
	const { content } = input;
	if (content.todayPending === 0 && content.tomorrow.length === 0) {
		return false;
	}
	return isDigestDue(input).due;
}

function joinWithAnd(items: readonly string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** "A, B e C", shortened to "A, B e mais 3" (or cut with "…") to fit `max`. */
function listNames(names: readonly string[], max: number): string {
	for (let shown = names.length; shown >= 1; shown--) {
		const hidden = names.length - shown;
		const items = names.slice(0, shown);
		const text = joinWithAnd(hidden > 0 ? [...items, `mais ${hidden}`] : items);
		if (text.length <= max) return text;
	}
	const suffix = names.length > 1 ? ` e mais ${names.length - 1}` : "";
	const first = names[0] ?? "";
	return `${first.slice(0, Math.max(1, max - suffix.length - 1))}…${suffix}`;
}

export interface DigestMessage {
	title: string;
	body: string;
}

/**
 * pt-BR text of the digest. With titles: "Hoje: Trocar filtro. 5 hábitos
 * hoje. Amanhã: Consulta dermatologista." Without titles (lock screen
 * privacy): "Você tem compromissos hoje e amanhã." and its variants.
 */
export function digestMessage(
	content: DigestContent,
	showTitles: boolean
): DigestMessage {
	const title = "Resumo do dia";
	const hasToday = content.todayPending > 0;
	const hasTomorrow = content.tomorrow.length > 0;
	if (!showTitles) {
		let body: string;
		if (hasToday && hasTomorrow) body = "Você tem compromissos hoje e amanhã.";
		else if (hasToday) body = "Você tem compromissos hoje.";
		else if (content.tomorrow.length === 1) {
			body = "Você tem um compromisso amanhã.";
		} else body = "Você tem compromissos amanhã.";
		return { title, body };
	}
	const total =
		content.todayTotal > 0
			? `${content.todayTotal} ${content.todayTotal === 1 ? "hábito" : "hábitos"} hoje.`
			: "";
	// Room left for names, shared between today's and tomorrow's lists.
	const fixed = total.length + "Hoje: . Amanhã: . ".length;
	const room = Math.max(20, MAX_BODY - fixed);
	const parts: string[] = [];
	if (content.highlights.length > 0) {
		const todayRoom = hasTomorrow ? Math.floor(room / 2) : room;
		parts.push(`Hoje: ${listNames(content.highlights, todayRoom)}.`);
	}
	if (total) parts.push(total);
	if (hasTomorrow) {
		const used = parts.join(" ").length + " Amanhã: .".length;
		parts.push(`Amanhã: ${listNames(content.tomorrow, MAX_BODY - used)}.`);
	}
	return { title, body: parts.join(" ") };
}
