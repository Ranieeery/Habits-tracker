import {
	type CalendarDate,
	DayQuery,
	DayResponse,
	type SummaryDay,
	SummaryQuery,
	SummaryResponse,
} from "@habits/contracts";
import {
	eachDay,
	firstDayOfYear,
	isHabitPossibleOn,
	lastDayOfYear,
	summarizeDay,
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
	summary: "Habits possible on a local date and which were completed",
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

export const statsRoutes = router()
	.openapi(dayRoute, async (c) => {
		const { date } = c.req.valid("query");
		const { db, userId } = c.var;
		const { timeZone } = await userToday(c);
		const [habits, completions] = await Promise.all([
			listHabits(db, userId),
			listLiveCompletions(db, userId, date, date),
		]);
		const possible = habits.filter((habit) =>
			isHabitPossibleOn(habit, date, { timeZone })
		);
		const done = new Set(completions.map((completion) => completion.habit_id));
		return c.json(
			{
				date,
				possible_habits: possible,
				completed_habit_ids: possible
					.filter((habit) => done.has(habit.id))
					.map((habit) => habit.id),
			},
			200
		);
	})
	.openapi(summaryRoute, async (c) => {
		const { year } = c.req.valid("query");
		const { db, userId } = c.var;
		const { timeZone, today } = await userToday(c);
		const from = firstDayOfYear(year);
		const yearEnd = lastDayOfYear(year);
		const to = today < yearEnd ? today : yearEnd;
		if (to < from) return c.json({ year, days: [] }, 200);

		// One query per table; "possible" and the ratio come from core.
		const [habits, completions] = await Promise.all([
			listHabits(db, userId),
			listLiveCompletions(db, userId, from, to),
		]);
		const byDate = new Map<CalendarDate, typeof completions>();
		for (const completion of completions) {
			const list = byDate.get(completion.date) ?? [];
			list.push(completion);
			byDate.set(completion.date, list);
		}
		const days: SummaryDay[] = [];
		for (const date of eachDay(from, to)) {
			const progress = summarizeDay(habits, byDate.get(date) ?? [], date, {
				timeZone,
			});
			if (progress.possible > 0) days.push({ date, ...progress });
		}
		return c.json({ year, days }, 200);
	});
