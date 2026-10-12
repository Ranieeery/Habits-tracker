// Pure helpers for the in-app time picker (no native picker, so 2.2.0 ships
// as an OTA update). The month calendar logic lives in @habits/core
// (`monthGrid`, `addMonths`...), shared with the web.

/** Reminder minutes: the cron runs every 15 minutes. */
export const REMINDER_MINUTES = ["00", "15", "30", "45"] as const;

/** `HH:MM` with the hour moved by `delta`, wrapping around midnight. */
export function stepHour(time: string, delta: number): string {
	const [hour = "20", minute = "00"] = time.split(":");
	const next = (((Number(hour) + delta) % 24) + 24) % 24;
	return `${String(next).padStart(2, "0")}:${minute}`;
}

/** `HH:MM` with the minutes replaced. */
export function withMinutes(time: string, minutes: string): string {
	const [hour = "20"] = time.split(":");
	return `${hour}:${minutes}`;
}
