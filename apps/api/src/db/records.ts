// Boundary between D1 rows and contract records. Writes parse the record with
// its `@habits/contracts` schema first, so nothing invalid (e.g. an unknown
// schedule type) reaches the database; reads parse the row back. `server_seq`
// (the sync cursor, set by triggers) is server bookkeeping: never written here
// and dropped on read.
import {
	Completion,
	Habit,
	PushSubscription,
	UserSettings,
} from "@habits/contracts";
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

export function toHabitRow(userId: string, habit: Habit): HabitInsert {
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

export function fromUserSettingsRow(row: UserSettingsRow): UserSettings {
	return UserSettings.parse(withoutUserId(row));
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
