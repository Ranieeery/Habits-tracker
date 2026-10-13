// What the app needs from its data source, in domain terms. Phase 5 reads and
// writes through the API (`remote-repository.ts`); Phase 7 swaps in a local
// SQLite implementation with an outbox, behind this same interface. Methods
// reject with `DataError` (see `errors.ts`), never with transport errors.
import type {
	CalendarDate,
	PushTestResponse,
	CreateHabitRequest,
	DayResponse,
	Habit,
	SummaryDay,
	UpdateHabitRequest,
	UpdateUserSettingsRequest,
	UserSettings,
} from "@habits/contracts";

export type DayData = DayResponse;

export interface HabitsRepository {
	getSettings(): Promise<UserSettings>;
	updateSettings(changes: UpdateUserSettingsRequest): Promise<UserSettings>;

	/** Every habit, archived ones included. */
	listHabits(): Promise<Habit[]>;
	createHabit(input: CreateHabitRequest): Promise<Habit>;
	/** Rename, reschedule, archive (`archived: true`) or unarchive. */
	updateHabit(habitId: string, changes: UpdateHabitRequest): Promise<Habit>;
	/**
	 * Deletes an archived habit (2.11.0): it leaves every day, past ones too.
	 * `DataError` `conflict` when it is not archived.
	 */
	deleteHabit(habitId: string): Promise<Habit>;
	/** Undoes a deletion (the habit comes back archived, with its history). */
	restoreHabit(habitId: string): Promise<Habit>;

	/** Habits possible on a local date and which of them were completed. */
	getDay(date: CalendarDate): Promise<DayData>;
	/** Completed/possible counts per local date of a year. */
	/**
	 * The year's days (heatmap, overview). With `habitId`, only that habit
	 * counts (2.7.0: the history filter and the per-habit rows).
	 */
	getYearSummary(
		year: number,
		options?: { habitId?: string }
	): Promise<SummaryDay[]>;
	/** Idempotent: marking done twice, or undone twice, is a no-op. */
	setCompletion(
		habitId: string,
		date: CalendarDate,
		completed: boolean
	): Promise<void>;
}

/**
 * This device's push registration with the server. Stays remote in Phase 7
 * (push needs the server anyway).
 */
export interface NotificationsRepository {
	/** Registers or refreshes an Expo push token; returns the device id. */
	registerDevice(token: string, label: string | null): Promise<string>;
	unregisterDevice(deviceId: string): Promise<void>;
	/** Rate limited (one per minute): `DataError` kind `rate_limited`. */
	sendTest(): Promise<PushTestResponse>;
}
