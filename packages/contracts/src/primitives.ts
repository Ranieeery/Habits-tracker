import { z } from "zod";

/** Record id. Clients generate UUID v7; any RFC 9562 UUID is accepted. */
export const Uuid = z.uuid();

/** Local calendar date, `YYYY-MM-DD`. Never an instant. */
export const CalendarDate = z.iso.date();
export type CalendarDate = z.infer<typeof CalendarDate>;

/** Instant as integer UTC milliseconds. */
export const TimestampMs = z.int().nonnegative();
export type TimestampMs = z.infer<typeof TimestampMs>;

/** Day of the week, Sunday = 0 ... Saturday = 6. */
export const Weekday = z.int().min(0).max(6);
export type Weekday = z.infer<typeof Weekday>;

function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** IANA time zone name, e.g. `America/Sao_Paulo`. */
export const TimeZone = z
	.string()
	.refine(isTimeZone, { message: "Invalid IANA time zone" });
export type TimeZone = z.infer<typeof TimeZone>;
