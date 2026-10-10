import { z } from "zod";
import { CalendarDate } from "./primitives.ts";

export const SummaryQuery = z.object({
	year: z.coerce.number().int().min(1970).max(9999),
});
export type SummaryQuery = z.infer<typeof SummaryQuery>;

/** Completion counts for one local date. */
export const SummaryDay = z.object({
	date: CalendarDate,
	completed: z.int().nonnegative(),
	possible: z.int().nonnegative(),
});
export type SummaryDay = z.infer<typeof SummaryDay>;

/**
 * Heatmap data for a year. Includes every date up to the user's today with at
 * least one possible habit (even with nothing completed); dates with nothing
 * possible may be omitted.
 */
export const SummaryResponse = z.object({
	year: z.int(),
	days: z.array(SummaryDay),
});
export type SummaryResponse = z.infer<typeof SummaryResponse>;
