import { z } from "zod";
import { Weekday } from "./primitives.ts";

/** Recurs on the given weekdays. */
export const WeekdaysSchedule = z.object({
	type: z.literal("weekdays"),
	days: z
		.array(Weekday)
		.min(1)
		.max(7)
		.refine((days) => new Set(days).size === days.length, {
			message: "Weekdays must be unique",
		}),
});
export type WeekdaysSchedule = z.infer<typeof WeekdaysSchedule>;

/**
 * When a habit recurs. New frequencies are added as new union members; clients
 * must be updated before the API starts returning them.
 */
export const Schedule = z.discriminatedUnion("type", [WeekdaysSchedule]);
export type Schedule = z.infer<typeof Schedule>;
export type ScheduleType = Schedule["type"];
