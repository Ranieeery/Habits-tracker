import { createMiddleware } from "hono/factory";
import { authOf, type AppEnv } from "./context.ts";
import { errorBody } from "./errors.ts";

/**
 * Rejects requests without a valid session (cookie, or `Authorization:
 * Bearer` through the bearer plugin) and exposes the user id to the routes.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
	const session = await authOf(c).api.getSession({
		headers: c.req.raw.headers,
	});
	if (!session) {
		return c.json(errorBody("unauthorized", "Authentication required"), 401);
	}
	c.set("userId", session.user.id);
	await next();
});
