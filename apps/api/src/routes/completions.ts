import {
	CompletionParams,
	CompletionResponse,
	SetCompletionRequest,
} from "@habits/contracts";
import { BACKFILL_DAYS, isWithinWriteWindow, writeWindow } from "@habits/core";
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
import { setCompletion } from "../repos/completions.ts";
import { getHabit } from "../repos/habits.ts";

const setRoute = createRoute({
	method: "put",
	path: "/habits/{habit_id}/completions/{date}",
	tags: ["completions"],
	summary: "Mark a habit done or undone on a local date",
	description: `Idempotent. The date must be within [today - ${BACKFILL_DAYS}, today + 1] in the user's time zone. Undoing keeps a tombstone (\`deleted_at\`).`,
	request: { params: CompletionParams, body: jsonBody(SetCompletionRequest) },
	responses: {
		200: jsonResponse(CompletionResponse, "Current state of the completion"),
		...commonErrors,
		...dateErrors,
		...notFoundError,
		...conflictError,
	},
});

export const completionRoutes = router().openapi(setRoute, async (c) => {
	const { habit_id, date } = c.req.valid("param");
	const { completed, id } = c.req.valid("json");
	const { db, userId } = c.var;

	if (!(await getHabit(db, userId, habit_id))) {
		return c.json(errorBody("not_found", "Habit not found"), 404);
	}
	const { now, today } = await userToday(c);
	if (!isWithinWriteWindow(date, today)) {
		return c.json(
			errorBody(
				"date_out_of_range",
				"Date is outside the editable window",
				writeWindow(today)
			),
			422
		);
	}
	const completion = await setCompletion(
		db,
		userId,
		{ habitId: habit_id, date, completed, id: id ?? uuidV7(now) },
		now
	);
	if (!completion) {
		return c.json(errorBody("conflict", "Completion id already in use"), 409);
	}
	return c.json({ completion }, 200);
});
