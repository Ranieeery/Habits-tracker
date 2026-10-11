import {
	CreateHabitRequest,
	HabitListResponse,
	HabitParams,
	HabitResponse,
	UpdateHabitRequest,
} from "@habits/contracts";
import { addDays, BACKFILL_DAYS, newHabit } from "@habits/core";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import {
	commonErrors,
	conflictError,
	dateErrors,
	errorBody,
	jsonBody,
	jsonResponse,
	notFoundError,
} from "../http/errors.ts";
import { userToday } from "../http/today.ts";
import { uuidV7 } from "../lib/ids.ts";
import { insertHabit, listHabits, updateHabit } from "../repos/habits.ts";

const tags = ["habits"];

const listRoute = createRoute({
	method: "get",
	path: "/habits",
	tags,
	summary: "List the user's habits (archived included, deleted excluded)",
	responses: {
		200: jsonResponse(HabitListResponse, "Habits"),
		...commonErrors,
	},
});

const createHabitRoute = createRoute({
	method: "post",
	path: "/habits",
	tags,
	summary: "Create a habit (idempotent by client-generated id)",
	description: `start_date may not be more than BACKFILL_DAYS (${BACKFILL_DAYS}) before the user's today.`,
	request: { body: jsonBody(CreateHabitRequest) },
	responses: {
		200: jsonResponse(HabitResponse, "Already created with this id"),
		201: jsonResponse(HabitResponse, "Created"),
		...commonErrors,
		...dateErrors,
		...conflictError,
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/habits/{habit_id}",
	tags,
	summary: "Rename, reschedule, archive or unarchive a habit",
	request: { params: HabitParams, body: jsonBody(UpdateHabitRequest) },
	responses: {
		200: jsonResponse(HabitResponse, "Updated"),
		...commonErrors,
		...notFoundError,
	},
});

export const habitRoutes = router()
	.openapi(listRoute, async (c) => {
		const habits = await listHabits(c.var.db, c.var.userId);
		return c.json({ habits }, 200);
	})
	.openapi(createHabitRoute, async (c) => {
		const body = c.req.valid("json");
		const { now, today } = await userToday(c);
		const earliest = addDays(today, -BACKFILL_DAYS);
		if (body.start_date < earliest) {
			return c.json(
				errorBody("date_out_of_range", "start_date is too far in the past", {
					earliest,
				}),
				422
			);
		}
		const habit = newHabit({ ...body, id: body.id ?? uuidV7(now) }, now);
		const result = await insertHabit(c.var.db, c.var.userId, habit);
		if (!result) {
			return c.json(errorBody("conflict", "Habit id already in use"), 409);
		}
		return result.created
			? c.json({ habit: result.habit }, 201)
			: c.json({ habit: result.habit }, 200);
	})
	.openapi(updateRoute, async (c) => {
		const { habit_id } = c.req.valid("param");
		const habit = await updateHabit(
			c.var.db,
			c.var.userId,
			habit_id,
			c.req.valid("json"),
			c.var.now()
		);
		if (!habit) return c.json(errorBody("not_found", "Habit not found"), 404);
		return c.json({ habit }, 200);
	});
