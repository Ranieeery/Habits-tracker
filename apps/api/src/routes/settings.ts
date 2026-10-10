import {
	UpdateUserSettingsRequest,
	UserSettingsResponse,
} from "@habits/contracts";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import { commonErrors, jsonBody, jsonResponse } from "../http/errors.ts";
import { ensureSettings, updateSettings } from "../repos/settings.ts";

const tags = ["settings"];

const getRoute = createRoute({
	method: "get",
	path: "/settings",
	tags,
	summary: "The user's settings",
	responses: {
		200: jsonResponse(UserSettingsResponse, "Settings"),
		...commonErrors,
	},
});

const updateRoute = createRoute({
	method: "patch",
	path: "/settings",
	tags,
	summary: "Update the time zone (IANA) and/or the reminder time",
	request: { body: jsonBody(UpdateUserSettingsRequest) },
	responses: {
		200: jsonResponse(UserSettingsResponse, "Updated settings"),
		...commonErrors,
	},
});

export const settingsRoutes = router()
	.openapi(getRoute, async (c) => {
		const settings = await ensureSettings(c.var.db, c.var.userId, c.var.now());
		return c.json({ settings }, 200);
	})
	.openapi(updateRoute, async (c) => {
		const settings = await updateSettings(
			c.var.db,
			c.var.userId,
			c.req.valid("json"),
			c.var.now()
		);
		return c.json({ settings }, 200);
	});
