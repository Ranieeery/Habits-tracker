// Morning digest: one push a day at the fixed MORNING_DIGEST_TIME in the
// user's time zone, with today's non-weekday habits, the overdue ones (2.8.0)
// and tomorrow's single dates. Pure: the instant, time zone, habits, completions, settings and the
// last sent date are parameters (the cron passes its scheduled time).
import {
	type Completion,
	type Habit,
	isSupportedSchedule,
} from "@habits/contracts";
import { addDays, type CalendarDate } from "./dates.ts";
import { overdueOn } from "./overdue.ts";
import { isWithinSendWindow, type LocalTime } from "./reminders.ts";
import { deadlineOf, firstCompletions } from "./deadline.ts";
import {
	countOn,
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

type DigestHabit = SchedulableHabit &
	Pick<Habit, "id" | "name" | "created_at" | "sort_key">;
type CompletionFacts = Pick<Completion, "habit_id" | "date" | "deleted_at">;

export interface DigestContent {
	/** Habits that count today (`isHabitCountedOn`). */
	todayTotal: number;
	/** Of those, the ones not completed yet. */
	todayPending: number;
	/** Names of today's pending habits whose schedule is not `weekdays`. */
	highlights: string[];
	/** Names of the overdue habits not completed yet (`overdueOn`, 2.8.0). */
	overdue: string[];
	/** Names of single-date habits happening tomorrow. */
	tomorrow: string[];
	/** Open deadline tasks due today (2.13.0; also in today's counts). */
	dueToday: string[];
	/** Open deadline tasks due tomorrow (2.13.0). */
	dueTomorrow: string[];
}

/**
 * What the digest of `today` would say. `completions` should cover
 * `overdueRange(today)`, or overdue habits are judged on less history.
 */
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
		overdue: overdueOn(habits, completions, today, options)
			.filter((item) => !item.completedToday)
			.map((item) => item.habit.name),
		tomorrow: [],
		dueToday: [],
		dueTomorrow: [],
	};
	const first = firstCompletions(completions);
	for (const habit of habits) {
		const supported = isSupportedSchedule(habit.schedule)
			? habit.schedule
			: null;
		const firstDone = first.get(habit.id) ?? null;
		const count = countOn(habit, today, done.has(habit.id), options, firstDone);
		if (count.counted) {
			content.todayTotal += 1;
			if (!count.done) {
				content.todayPending += 1;
				if (supported?.type === "deadline") content.dueToday.push(habit.name);
				else if (supported && supported.type !== "weekdays") {
					content.highlights.push(habit.name);
				}
			}
		}
		// Due tomorrow and not done by today (open, started, not archived).
		const deadline = deadlineOf(habit.schedule);
		if (
			deadline &&
			deadline.due_date === tomorrowDate &&
			(firstDone === null || firstDone > today) &&
			isHabitPossibleOn(habit, tomorrowDate, options)
		) {
			content.dueTomorrow.push(habit.name);
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
 * is still pending today, a habit is overdue, or a single-date habit happens
 * tomorrow.
 */
export function shouldSendMorningDigest(input: ShouldSendDigestInput): boolean {
	const { content } = input;
	if (
		content.todayPending === 0 &&
		content.overdue.length === 0 &&
		content.tomorrow.length === 0 &&
		content.dueTomorrow.length === 0
	) {
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
 * hoje. 1 atrasado: Pagar condomínio. Amanhã: Consulta dermatologista."
 * Without titles (lock screen privacy): "Você tem compromissos hoje e
 * amanhã.", "Você tem compromissos hoje e 2 hábitos atrasados." and their
 * variants (counts, never names).
 */
export function digestMessage(
	content: DigestContent,
	showTitles: boolean
): DigestMessage {
	const title = "Resumo do dia";
	const hasToday = content.todayPending > 0;
	const overdueCount = content.overdue.length;
	const tomorrowCount = content.tomorrow.length + content.dueTomorrow.length;
	const hasTomorrow = tomorrowCount > 0;
	if (!showTitles && overdueCount > 0) {
		// Counts only, like the reminder: "Você tem compromissos hoje e 2
		// hábitos atrasados."
		const clauses: string[] = [];
		if (hasToday) clauses.push("compromissos hoje");
		clauses.push(
			`${overdueCount} ${overdueCount === 1 ? "hábito atrasado" : "hábitos atrasados"}`
		);
		if (hasTomorrow) {
			clauses.push(
				tomorrowCount === 1 ? "um compromisso amanhã" : "compromissos amanhã"
			);
		}
		return { title, body: `Você tem ${joinWithAnd(clauses)}.` };
	}
	if (!showTitles) {
		let body: string;
		if (hasToday && hasTomorrow) body = "Você tem compromissos hoje e amanhã.";
		else if (hasToday) body = "Você tem compromissos hoje.";
		else if (tomorrowCount === 1) {
			body = "Você tem um compromisso amanhã.";
		} else body = "Você tem compromissos amanhã.";
		return { title, body };
	}
	// 2.13.0: deadline lists take a fixed share at the end; without them the
	// text is exactly what it was before.
	const dueParts = [
		content.dueToday.length > 0 ? ["Vence hoje: ", content.dueToday] : null,
		content.dueTomorrow.length > 0
			? ["Vence amanhã: ", content.dueTomorrow]
			: null,
	].filter((part): part is [string, string[]] => part !== null);
	const dueShare = 70;
	const maxBody = MAX_BODY - dueShare * dueParts.length;
	const hasOtherTomorrow = content.tomorrow.length > 0;
	const total =
		content.todayTotal > 0
			? `${content.todayTotal} ${content.todayTotal === 1 ? "hábito" : "hábitos"} hoje.`
			: "";
	const overduePrefix =
		overdueCount > 0
			? `${overdueCount} ${overdueCount === 1 ? "atrasado" : "atrasados"}: `
			: "";
	// Room left for names, shared between today's, the overdue and
	// tomorrow's lists (the last one takes what is left).
	const fixed =
		total.length +
		"Hoje: . Amanhã: . ".length +
		(overdueCount > 0 ? overduePrefix.length + ". ".length : 0);
	const room = Math.max(20, maxBody - fixed);
	const lists = [
		content.highlights.length > 0,
		overdueCount > 0,
		hasOtherTomorrow,
	];
	const share = Math.floor(room / lists.filter(Boolean).length);
	const parts: string[] = [];
	if (content.highlights.length > 0) {
		const todayRoom = lists[1] || hasOtherTomorrow ? share : room;
		parts.push(`Hoje: ${listNames(content.highlights, todayRoom)}.`);
	}
	if (total) parts.push(total);
	if (overdueCount > 0) {
		const used = parts.join(" ").length + ` ${overduePrefix}.`.length;
		const overdueRoom = hasOtherTomorrow ? share : maxBody - used;
		parts.push(`${overduePrefix}${listNames(content.overdue, overdueRoom)}.`);
	}
	if (hasOtherTomorrow) {
		const used = parts.join(" ").length + " Amanhã: .".length;
		parts.push(`Amanhã: ${listNames(content.tomorrow, maxBody - used)}.`);
	}
	for (const [prefix, names] of dueParts) {
		const used = parts.join(" ").length + ` ${prefix}.`.length;
		const left = MAX_BODY - used;
		parts.push(
			`${prefix}${listNames(names, Math.max(10, Math.min(left, dueShare)))}.`
		);
	}
	return { title, body: parts.join(" ") };
}
