import {
	CreateHabitRequest,
	HabitListResponse,
	HabitParams,
	HabitResponse,
	UpdateHabitRequest,
} from "@habits/contracts";
import {
	BACKFILL_DAYS,
	checkHabitDates,
	earliestStartDate,
	habitDatesError,
	keyAfterLast,
	newHabit,
} from "@habits/core";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import {
	commonErrors,
	conflictError,
	dateErrors,
	errorBody,
	errorResponse,
	jsonBody,
	jsonResponse,
	notFoundError,
} from "../http/errors.ts";
import {
	clientScheduleVersion,
	isReadableBy,
} from "../http/schedule-version.ts";
import { userToday } from "../http/today.ts";
import { uuidV7 } from "../lib/ids.ts";
import {
	deleteHabit,
	insertHabit,
	listHabits,
	restoreHabit,
	updateHabit,
} from "../repos/habits.ts";

const tags = ["habits"];

const listRoute = createRoute({
	method: "get",
	path: "/habits",
	tags,
	summary: "List the user's habits (archived included, deleted excluded)",
	description:
		"Habits whose schedule type is newer than the client's X-Habits-Schedule-Version (1 when absent) are left out.",
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
	description: `For weekday schedules, start_date may not be more than BACKFILL_DAYS (${BACKFILL_DAYS}) before the user's today; other schedules start today or later, and a single date may not be in the past.`,
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
	description:
		"A new single-date schedule may not be in the past nor before the habit's start_date.",
	request: { params: HabitParams, body: jsonBody(UpdateHabitRequest) },
	responses: {
		200: jsonResponse(HabitResponse, "Updated"),
		...commonErrors,
		...dateErrors,
		...notFoundError,
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/habits/{habit_id}",
	tags,
	summary: "Delete an archived habit (tombstone, undone by restore)",
	description:
		"Only archived habits can be deleted (409 otherwise). The habit leaves every day, past ones included; its completions are kept, so a restore brings its history back. Idempotent: deleting a deleted habit returns it unchanged. Purged after 90 days.",
	request: { params: HabitParams },
	responses: {
		200: jsonResponse(HabitResponse, "Deleted"),
		...commonErrors,
		...notFoundError,
		409: errorResponse("The habit is not archived (`conflict`)"),
	},
});

const restoreRoute = createRoute({
	method: "post",
	path: "/habits/{habit_id}/restore",
	tags,
	summary: "Restore a deleted habit (it stays archived)",
	description: "Restoring a habit that is not deleted returns it unchanged.",
	request: { params: HabitParams },
	responses: {
		200: jsonResponse(HabitResponse, "Restored"),
		...commonErrors,
		...notFoundError,
	},
});

export const habitRoutes = router()
	.openapi(listRoute, async (c) => {
		const version = clientScheduleVersion(c);
		const habits = await listHabits(c.var.db, c.var.userId);
		return c.json(
			{ habits: habits.filter((habit) => isReadableBy(habit, version)) },
			200
		);
	})
	.openapi(createHabitRoute, async (c) => {
		const body = c.req.valid("json");
		const { now, today } = await userToday(c);
		const earliest = earliestStartDate(body.schedule, today);
		const problem = checkHabitDates(body, earliest);
		if (problem)
			return c.json({ error: habitDatesError(problem, earliest) }, 422);
		// Without a key (clients older than 2.4.0, or the web) it goes last.
		const sort_key =
			body.sort_key ?? keyAfterLast(await listHabits(c.var.db, c.var.userId));
		const habit = newHabit(
			{ ...body, id: body.id ?? uuidV7(now), sort_key },
			now
		);
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
		const changes = c.req.valid("json");
		const { schedule } = changes;
		const today = schedule ? (await userToday(c)).today : null;
		const result = await updateHabit(
			c.var.db,
			c.var.userId,
			habit_id,
			changes,
			c.var.now(),
			(current) => {
				if (!schedule || today === null) return null;
				const earliest = earliestStartDate(schedule, today);
				const problem = checkHabitDates(
					{ schedule, start_date: current.start_date },
					earliest,
					{ checkStart: false }
				);
				return problem ? habitDatesError(problem, earliest) : null;
			}
		);
		if (!result) return c.json(errorBody("not_found", "Habit not found"), 404);
		if ("error" in result) return c.json({ error: result.error }, 422);
		return c.json({ habit: result }, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { habit_id } = c.req.valid("param");
		const result = await deleteHabit(
			c.var.db,
			c.var.userId,
			habit_id,
			c.var.now()
		);
		if (!result) return c.json(errorBody("not_found", "Habit not found"), 404);
		if ("error" in result) return c.json({ error: result.error }, 409);
		return c.json({ habit: result }, 200);
	})
	.openapi(restoreRoute, async (c) => {
		const { habit_id } = c.req.valid("param");
		const habit = await restoreHabit(
			c.var.db,
			c.var.userId,
			habit_id,
			c.var.now()
		);
		if (!habit) return c.json(errorBody("not_found", "Habit not found"), 404);
		return c.json({ habit }, 200);
	});
