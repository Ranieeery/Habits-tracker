// What the app needs from its data source, in domain terms. Phase 5 reads and
// writes through the API (`remote-repository.ts`); Phase 7 swaps in a local
// SQLite implementation with an outbox, behind this same interface. Methods
// reject with `DataError` (see `errors.ts`), never with transport errors.
import type {
	CalendarDate,
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

	/** Habits possible on a local date and which of them were completed. */
	getDay(date: CalendarDate): Promise<DayData>;
	/** Completed/possible counts per local date of a year. */
	getYearSummary(year: number): Promise<SummaryDay[]>;
	/** Idempotent: marking done twice, or undone twice, is a no-op. */
	setCompletion(
		habitId: string,
		date: CalendarDate,
		completed: boolean
	): Promise<void>;
}
