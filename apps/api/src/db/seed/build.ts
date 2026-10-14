// Development seed: a fixed dev user with habits and a year of completions.
// Pure and deterministic: the reference "today" is a parameter and nothing
// reads the clock.
import {
	type Completion,
	DEFAULT_TIME_ZONE,
	type Habit,
	type Schedule,
	type UserSettings,
	type Weekday,
} from "@habits/contracts";
import {
	addDays,
	type CalendarDate,
	eachDay,
	heatmapLevel,
	type HeatmapLevel,
	initialSortKeys,
	isHabitPossibleOn,
	parseCalendarDate,
} from "@habits/core";
import { saoPauloInstant, unitHash, uuidV7 } from "./deterministic.ts";

/** Fixed id of the development user (also its Better Auth `user` row). */
export const DEV_USER_ID = "0199c9a0-0000-7000-8000-000000000001";

/** Local-only sign-in of the development user (printed by the seed script). */
export const DEV_USER_EMAIL = "dev@habits.local";
export const DEV_USER_PASSWORD = "habits-dev-password";

/** Reference date used when the seed script gets no `--today`. */
export const DEFAULT_SEED_TODAY: CalendarDate = "2026-10-09";

export const SEED_TIME_ZONE = DEFAULT_TIME_ZONE;

/** Days of the current streak of the "water" habit, ending today. */
export const LONG_STREAK_DAYS = 90;

export interface SeedUser {
	name: string;
	email: string;
	created_at: number;
}

export interface Seed {
	userId: string;
	user: SeedUser;
	today: CalendarDate;
	settings: UserSettings;
	habits: Habit[];
	completions: Completion[];
}

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface HabitSpec {
	key: string;
	name: string;
	days: Weekday[];
	/** Start date relative to the reference year. */
	start: (year: number) => CalendarDate;
	/** Archive date (archived at 21:00 local) if it is before today. */
	archived?: (year: number) => CalendarDate;
}

const lastYear = (monthDay: string) => (year: number) =>
	`${year - 1}-${monthDay}`;
const thisYear = (monthDay: string) => (year: number) => `${year}-${monthDay}`;

// Four daily habits plus weekday ones keep 5-7 habits possible per day, so
// every heatmap level is reachable (level 1 needs at least 6 possible).
const HABITS: HabitSpec[] = [
	{
		key: "water",
		name: "Beber 2 litros de água",
		days: EVERY_DAY,
		start: lastYear("12-01"),
	},
	{
		key: "read",
		name: "Ler 20 páginas",
		days: EVERY_DAY,
		start: lastYear("12-01"),
	},
	{
		key: "meditate",
		name: "Meditar 10 minutos",
		days: EVERY_DAY,
		start: lastYear("12-15"),
	},
	{
		key: "journal",
		name: "Escrever no diário",
		days: EVERY_DAY,
		start: thisYear("01-01"),
	},
	{
		key: "workout",
		name: "Treinar",
		days: [1, 3, 5],
		start: lastYear("12-01"),
	},
	{
		key: "stretch",
		name: "Alongamento",
		days: [2, 4, 6],
		start: lastYear("12-20"),
	},
	{
		key: "sleep",
		name: "Dormir antes das 23h",
		days: [0, 1, 2, 3, 4],
		start: lastYear("12-01"),
	},
	{
		key: "english",
		name: "Estudar inglês",
		days: [1, 2, 3, 4, 5],
		start: lastYear("12-20"),
		archived: thisYear("06-30"),
	},
	{
		key: "review",
		name: "Revisão semanal",
		days: [0],
		start: thisYear("02-01"),
	},
];

/**
 * Habits with the schedules added in 2.2.0, created on the reference day
 * (start today), so they leave the past heatmap as it was: one of each type,
 * plus a daily one with a long description (2.12.0: the note icon, the line
 * under the name, the quick look cut after 4 lines and the habit page).
 */
const SCHEDULED_TODAY: readonly {
	key: string;
	name: string;
	description?: string;
	schedule: (today: CalendarDate) => Schedule;
}[] = [
	{
		key: "described",
		name: "Rotina da noite (teste)",
		description: [
			"Desligar as telas às **22h** e preparar o dia seguinte.",
			"- separar a roupa",
			"- *revisar* a agenda de amanhã",
			"- encher a garrafa de água",
			"- ler 10 páginas",
			"",
			"Guia: [higiene do sono](https://www.sleepfoundation.org/sleep-hygiene).",
			"Literal, sem formatação: # título, <b>html</b> e `código`.",
		].join("\n"),
		schedule: () => ({ type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] }),
	},
	{
		key: "dermatologist",
		name: "Consulta no dermatologista",
		schedule: (today) => ({ type: "once", date: addDays(today, 2) }),
	},
	{
		key: "filter",
		name: "Trocar filtro",
		schedule: (today) => ({ type: "interval", every: 8, anchor_date: today }),
	},
	{
		key: "condo",
		name: "Pagar condomínio",
		schedule: () => ({ type: "monthly_days", days: [20] }),
	},
	{
		// 2.13.0: a task with a deadline a week ahead ("Com prazo" on today).
		key: "report",
		name: "Entregar relatório (teste)",
		schedule: (today) => ({ type: "deadline", due_date: addDays(today, 7) }),
	},
	{
		key: "birthday",
		name: "Aniversário da Ana",
		schedule: () => ({ type: "yearly", month: 11, day: 20 }),
	},
];

/** Level and how often it is picked; skewed toward good days. */
const LEVEL_WEIGHTS: readonly (readonly [HeatmapLevel, number])[] = [
	[0, 1],
	[1, 1],
	[2, 1.5],
	[3, 2],
	[4, 2.5],
	[5, 3],
];
const TOTAL_WEIGHT = LEVEL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function pickLevel(date: CalendarDate): HeatmapLevel {
	let roll = unitHash(`level:${date}`) * TOTAL_WEIGHT;
	for (const [level, weight] of LEVEL_WEIGHTS) {
		roll -= weight;
		if (roll < 0) return level;
	}
	return 5;
}

/** Smallest count with the wanted level out of `possible`, or the closest. */
function countForLevel(level: HeatmapLevel, possible: number): number {
	let best = 0;
	for (let count = 0; count <= possible; count++) {
		const reached = heatmapLevel(count / possible);
		if (reached === level) return count;
		if (
			Math.abs(reached - level) <
			Math.abs(heatmapLevel(best / possible) - level)
		) {
			best = count;
		}
	}
	return best;
}

interface Overrides {
	/** `habitKey:date` pairs that must be done (when possible). */
	done: Set<string>;
	/** `habitKey:date` pairs that must not be done. */
	missed: Set<string>;
}

function buildOverrides(today: CalendarDate, year: number): Overrides {
	const done = new Set<string>();
	const missed = new Set<string>();

	// Long current streak: water every day up to today, after a miss.
	for (const date of eachDay(addDays(today, -(LONG_STREAK_DAYS - 1)), today)) {
		done.add(`water:${date}`);
	}
	missed.add(`water:${addDays(today, -LONG_STREAK_DAYS)}`);

	// Year boundary: completions from late December to early January.
	for (const date of eachDay(`${year - 1}-12-26`, `${year}-01-05`)) {
		done.add(`water:${date}`);
		done.add(`read:${date}`);
	}

	// Long streak that was broken: reading for 45 days, then a miss.
	for (const date of eachDay(`${year}-03-01`, `${year}-04-14`)) {
		done.add(`read:${date}`);
	}
	missed.add(`read:${year}-04-15`);

	// Workouts in short runs separated by misses.
	for (const date of eachDay(`${year}-05-01`, `${year}-05-31`)) {
		const day = parseCalendarDate(date).day;
		(day % 10 === 0 ? missed : done).add(`workout:${date}`);
	}

	return { done, missed };
}

/** Day whose "read" completion is un-checked, leaving a tombstone. */
function tombstoneDate(today: CalendarDate): CalendarDate {
	return addDays(today, -3);
}

export function buildSeed({
	today = DEFAULT_SEED_TODAY,
}: { today?: CalendarDate } = {}): Seed {
	const year = parseCalendarDate(today).year;
	const timeZone = SEED_TIME_ZONE;

	const habits: Habit[] = HABITS.map((spec) => {
		const start_date = spec.start(year);
		const created_at = saoPauloInstant(start_date, 9);
		// Only archived once the archive date has passed (no future instants).
		const archiveDate = spec.archived?.(year);
		const archived_at =
			archiveDate !== undefined && archiveDate < today
				? saoPauloInstant(archiveDate, 21)
				: null;
		return {
			id: uuidV7(created_at, `habit:${spec.key}`),
			name: spec.name,
			description: "",
			schedule: { type: "weekdays", days: spec.days },
			start_date,
			archived_at,
			sort_key: "",
			created_at,
			updated_at: archived_at ?? created_at,
			deleted_at: null,
		};
	});
	const keyOf = new Map(habits.map((habit, i) => [habit, HABITS[i]!.key]));

	const overrides = buildOverrides(today, year);
	const tombstone = tombstoneDate(today);
	const completions: Completion[] = [];
	const firstDate = habits.reduce(
		(min, habit) => (habit.start_date < min ? habit.start_date : min),
		today
	);

	for (const date of eachDay(firstDate, today)) {
		const possible = habits.filter((habit) =>
			isHabitPossibleOn(habit, date, { timeZone })
		);
		if (possible.length === 0) continue;

		const forced = possible.filter((habit) =>
			overrides.done.has(`${keyOf.get(habit)}:${date}`)
		);
		const optional = possible
			.filter(
				(habit) =>
					!forced.includes(habit) &&
					!overrides.missed.has(`${keyOf.get(habit)}:${date}`)
			)
			.sort(
				(a, b) =>
					unitHash(`pick:${keyOf.get(a)}:${date}`) -
					unitHash(`pick:${keyOf.get(b)}:${date}`)
			);
		const target = countForLevel(pickLevel(date), possible.length);
		const done = [
			...forced,
			...optional.slice(0, Math.max(0, target - forced.length)),
		];
		if (date === tombstone) {
			const read = possible.find((habit) => keyOf.get(habit) === "read");
			if (read && !done.includes(read)) done.push(read);
		}

		for (const habit of done) {
			const key = `${keyOf.get(habit)}:${date}`;
			const hour = 7 + Math.floor(unitHash(`hour:${key}`) * 15);
			const minute = Math.floor(unitHash(`minute:${key}`) * 60);
			const completed_at = saoPauloInstant(date, hour, minute);
			const deleted_at =
				date === tombstone && keyOf.get(habit) === "read"
					? completed_at + 2 * 3_600_000
					: null;
			completions.push({
				id: uuidV7(completed_at, `completion:${key}`),
				habit_id: habit.id,
				date,
				completed_at,
				created_at: completed_at,
				updated_at: deleted_at ?? completed_at,
				deleted_at,
			});
		}
	}

	// After the completions: they never get any (they start today).
	for (const spec of SCHEDULED_TODAY) {
		const created_at = saoPauloInstant(today, 8);
		const schedule = spec.schedule(today);
		habits.push({
			id: uuidV7(created_at, `habit:${spec.key}`),
			name: spec.name,
			description: spec.description ?? "",
			schedule,
			start_date: schedule.type === "once" ? schedule.date : today,
			archived_at: null,
			sort_key: "",
			created_at,
			updated_at: created_at,
			deleted_at: null,
		});
	}

	// List order = the order above, with the first keys of core's scheme.
	const keys = initialSortKeys(habits.length);
	habits.forEach((habit, index) => {
		habit.sort_key = keys[index]!;
	});

	const settingsAt = saoPauloInstant(`${year - 1}-12-01`, 8);
	return {
		userId: DEV_USER_ID,
		user: { name: "Dev", email: DEV_USER_EMAIL, created_at: settingsAt },
		today,
		settings: {
			timezone: timeZone,
			reminder_time: "21:00",
			morning_digest_enabled: true,
			show_titles_in_notifications: true,
			created_at: settingsAt,
			updated_at: settingsAt,
		},
		habits,
		completions,
	};
}
