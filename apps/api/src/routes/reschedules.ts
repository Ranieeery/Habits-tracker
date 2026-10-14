// Postponed occurrences of fixed-day habits (2.16.0). Create and undo are
// checked by core (`checkReschedule`, `checkRescheduleUndo`) against the
// user's today, the same rules as the sync push and both apps.
import {
	CreateRescheduleRequest,
	RescheduleItemParams,
	RescheduleParams,
	RescheduleResponse,
	ReschedulesResponse,
} from "@habits/contracts";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import {
	commonErrors,
	dateErrors,
	errorBody,
	errorResponse,
	jsonBody,
	jsonResponse,
	notFoundError,
} from "../http/errors.ts";
import { userToday } from "../http/today.ts";
import { listRescheduleCompletions } from "../repos/completions.ts";
import { getHabit } from "../repos/habits.ts";
import {
	createReschedule,
	listLiveReschedules,
	undoRescheduleRow,
} from "../repos/reschedules.ts";

const tags = ["reschedules"];

const listRoute = createRoute({
	method: "get",
	path: "/reschedules",
	tags,
	summary:
		"The user's live postponements and the live completions of their habits",
	responses: {
		200: jsonResponse(ReschedulesResponse, "Postponements"),
		...commonErrors,
	},
});

const createRescheduleRoute = createRoute({
	method: "post",
	path: "/habits/{habit_id}/reschedules",
	tags,
	summary: "Postpone one occurrence of a single-date or days-of-month habit",
	description:
		"Idempotent per id. 409 `conflict` when the occurrence was postponed twice already or changed meanwhile (another device); 422 for dates outside the rules (`details.reason`).",
	request: {
		params: RescheduleParams,
		body: jsonBody(CreateRescheduleRequest),
	},
	responses: {
		201: jsonResponse(RescheduleResponse, "Postponed"),
		200: jsonResponse(RescheduleResponse, "Already postponed with this id"),
		...commonErrors,
		...dateErrors,
		...notFoundError,
		409: errorResponse("Limit reached or postponed elsewhere (`conflict`)"),
	},
});

const undoRoute = createRoute({
	method: "delete",
	path: "/habits/{habit_id}/reschedules/{reschedule_id}",
	tags,
	summary: "Undo the last postponement of an occurrence (tombstone)",
	description:
		"Only the last live postponement, while the date it returns to is today or later. Undoing an undone one returns it unchanged.",
	request: { params: RescheduleItemParams },
	responses: {
		200: jsonResponse(RescheduleResponse, "Undone"),
		...commonErrors,
		...dateErrors,
		...notFoundError,
		409: errorResponse("Not the last postponement (`conflict`)"),
	},
});

export const rescheduleRoutes = router()
	.openapi(listRoute, async (c) => {
		const { db, userId } = c.var;
		const reschedules = await listLiveReschedules(db, userId);
		const completions =
			reschedules.length === 0
				? []
				: await listRescheduleCompletions(db, userId);
		return c.json({ reschedules, completions }, 200);
	})
	.openapi(createRescheduleRoute, async (c) => {
		const { habit_id } = c.req.valid("param");
		const body = c.req.valid("json");
		const { db, userId } = c.var;
		const habit = await getHabit(db, userId, habit_id);
		if (!habit) return c.json(errorBody("not_found", "Habit not found"), 404);
		const { now, today } = await userToday(c);
		const result = await createReschedule(db, userId, habit, body, today, now);
		if (!result.ok) {
			return result.error.code === "conflict"
				? c.json({ error: result.error }, 409)
				: c.json({ error: result.error }, 422);
		}
		return result.created
			? c.json({ reschedule: result.reschedule }, 201)
			: c.json({ reschedule: result.reschedule }, 200);
	})
	.openapi(undoRoute, async (c) => {
		const { habit_id, reschedule_id } = c.req.valid("param");
		const { db, userId } = c.var;
		const habit = await getHabit(db, userId, habit_id);
		if (!habit) return c.json(errorBody("not_found", "Habit not found"), 404);
		const { now, today } = await userToday(c);
		const result = await undoRescheduleRow(
			db,
			userId,
			habit,
			reschedule_id,
			today,
			now
		);
		if (!result) {
			return c.json(errorBody("not_found", "Reschedule not found"), 404);
		}
		if (!result.ok) {
			return result.error.code === "conflict"
				? c.json({ error: result.error }, 409)
				: c.json({ error: result.error }, 422);
		}
		return c.json({ reschedule: result.reschedule }, 200);
	});
