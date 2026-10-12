// Boundary between D1 rows and contract records. Writes parse the record with
// its `@habits/contracts` schema first, so nothing invalid (e.g. an unknown
// schedule type) reaches the database; reads parse the row back, keeping a
// schedule type this version does not know (a rollback after a newer API
// wrote it) instead of failing every read. `server_seq`
// (the sync cursor, set by triggers) is server bookkeeping: never written here
// and dropped on read.
import {
	Completion,
	Habit,
	PushSubscription,
	Schedule,
	UserSettings,
} from "@habits/contracts";
import { roundDownToQuarter } from "@habits/core";
import type {
	CompletionRow,
	completions,
	HabitRow,
	habits,
	PushSubscriptionRow,
	pushSubscriptions,
	UserSettingsRow,
	userSettings,
} from "./schema.ts";

type HabitInsert = typeof habits.$inferInsert;
type CompletionInsert = typeof completions.$inferInsert;
type UserSettingsInsert = typeof userSettings.$inferInsert;
type PushSubscriptionInsert = typeof pushSubscriptions.$inferInsert;

/** Drops `user_id`; records never expose it. */
function withoutUserId<T extends { user_id: string }>({
	user_id: _,
	...record
}: T): Omit<T, "user_id"> {
	return record;
}

/** Drops `user_id` and the sync `server_seq`. */
function withoutServerFields<
	T extends { user_id: string; server_seq: number },
>({ server_seq: _, ...row }: T): Omit<Omit<T, "server_seq">, "user_id"> {
	return withoutUserId(row);
}

/** A habit as written: its schedule must be one this version knows. */
const WritableHabit = Habit.extend({ schedule: Schedule });

export function toHabitRow(userId: string, habit: Habit): HabitInsert {
	return { ...WritableHabit.parse(habit), user_id: userId };
}

/**
 * A changed habit for a partial update. The schedule is parsed tolerantly:
 * a changed schedule was already validated with `Schedule` by the request or
 * mutation schema, and an unchanged unknown one (written by a newer API) is
 * not rewritten (`changedHabitFields` writes only the fields a change carries).
 */
export function toHabitPatchRow(userId: string, habit: Habit): HabitInsert {
	return { ...Habit.parse(habit), user_id: userId };
}

export function fromHabitRow(row: HabitRow): Habit {
	return Habit.parse(withoutServerFields(row));
}

export function toCompletionRow(
	userId: string,
	completion: Completion
): CompletionInsert {
	return { ...Completion.parse(completion), user_id: userId };
}

export function fromCompletionRow(row: CompletionRow): Completion {
	return Completion.parse(withoutServerFields(row));
}

export function toUserSettingsRow(
	userId: string,
	settings: UserSettings
): UserSettingsInsert {
	return { ...UserSettings.parse(settings), user_id: userId };
}

/**
 * Reads settings. A reminder time off the 15-minute grid (written by a 2.1.0
 * API between migration `0005` and the 2.2.0 deploy) is rounded down like
 * the migration did, instead of failing the read.
 */
export function fromUserSettingsRow(row: UserSettingsRow): UserSettings {
	const record = withoutUserId(row);
	return UserSettings.parse({
		...record,
		reminder_time:
			record.reminder_time === null
				? null
				: roundDownToQuarter(record.reminder_time),
	});
}

export function toPushSubscriptionRow(
	userId: string,
	subscription: PushSubscription
): PushSubscriptionInsert {
	const parsed = PushSubscription.parse(subscription);
	const empty = { endpoint: null, p256dh: null, auth: null, token: null };
	return { ...empty, ...parsed, user_id: userId };
}

export function fromPushSubscriptionRow(
	row: PushSubscriptionRow
): PushSubscription {
	const { endpoint, p256dh, auth, token, ...common } = withoutUserId(row);
	return PushSubscription.parse(
		row.kind === "webpush"
			? { ...common, endpoint, p256dh, auth }
			: { ...common, token }
	);
}
