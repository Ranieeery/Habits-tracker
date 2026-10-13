import {
	DayQuery,
	DayResponse,
	SummaryQuery,
	SummaryResponse,
} from "@habits/contracts";
import {
	dayView,
	firstDayOfYear,
	lastDayOfYear,
	overdueRange,
	summarizeYear,
	todayView,
} from "@habits/core";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import { commonErrors, jsonResponse } from "../http/errors.ts";
import { userToday } from "../http/today.ts";
import { listLiveCompletions } from "../repos/completions.ts";
import { listHabits } from "../repos/habits.ts";

const tags = ["stats"];

const dayRoute = createRoute({
	method: "get",
	path: "/day",
	tags,
	summary:
		"Habits possible on a local date and which were completed; on the user's today, also the overdue ones",
	request: { query: DayQuery },
	responses: { 200: jsonResponse(DayResponse, "Day"), ...commonErrors },
});

const summaryRoute = createRoute({
	method: "get",
	path: "/summary",
	tags,
	summary: "Heatmap data for a year, up to the user's today",
	request: { query: SummaryQuery },
	responses: { 200: jsonResponse(SummaryResponse, "Summary"), ...commonErrors },
});

// One query per table; "possible" and the counts come from core, the same
// functions the mobile app runs on its local database.
export const statsRoutes = router()
	.openapi(dayRoute, async (c) => {
		const { date } = c.req.valid("query");
		const { db, userId } = c.var;
		const { timeZone, today } = await userToday(c);
		// Today also lists the overdue fixed-day habits (2.8.0), which need the
		// completions of the last OVERDUE_DAYS: same query, wider range.
		const isToday = date === today;
		const range = isToday ? overdueRange(today) : { from: date, to: date };
		const [habits, completions] = await Promise.all([
			listHabits(db, userId),
			listLiveCompletions(db, userId, range.from, range.to),
		]);
		const view = isToday ? todayView : dayView;
		return c.json(view(habits, completions, date, { timeZone }), 200);
	})
	.openapi(summaryRoute, async (c) => {
		const { year } = c.req.valid("query");
		const { db, userId } = c.var;
		const { timeZone, today } = await userToday(c);
		const from = firstDayOfYear(year);
		const yearEnd = lastDayOfYear(year);
		const to = today < yearEnd ? today : yearEnd;
		if (to < from) return c.json({ year, days: [] }, 200);

		const [habits, completions] = await Promise.all([
			listHabits(db, userId),
			listLiveCompletions(db, userId, from, to),
		]);
		const days = summarizeYear(habits, completions, { year, today, timeZone });
		return c.json({ year, days }, 200);
	});
