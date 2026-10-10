import { swaggerUI } from "@hono/swagger-ui";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { version } from "../package.json";
import { AUTH_BASE_PATH } from "./auth/options.ts";
import { readConfig } from "./config.ts";
import { createDb } from "./db/client.ts";
import { authOf, router } from "./http/context.ts";
import { codeForStatus, errorBody } from "./http/errors.ts";
import { requireUser } from "./http/require-user.ts";
import type { Clock } from "./lib/clock.ts";
import { completionRoutes } from "./routes/completions.ts";
import { habitRoutes } from "./routes/habits.ts";
import { pushRoutes } from "./routes/push.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { statsRoutes } from "./routes/stats.ts";

export interface AppOptions {
	/** Current instant; tests pass a fixed clock. */
	now: Clock;
	/** Outgoing requests to push services; tests pass a fake. */
	fetch?: typeof fetch;
}

/**
 * The whole API under `/v1`. Order matters: public routes (health, auth,
 * docs) are registered before `requireUser`, which guards everything after
 * it, including unknown paths.
 */
export function createApp({
	now,
	fetch: fetcher = (input, init) => fetch(input, init),
}: AppOptions) {
	const app = router().basePath("/v1");

	app.use("*", async (c, next) => {
		c.set("config", readConfig(c.env));
		c.set("db", createDb(c.env.DB));
		c.set("now", now);
		c.set("fetch", fetcher);
		await next();
	});

	// Only the configured browser origins (none in production, where web and
	// API share a domain). Native apps do not need CORS.
	app.use("*", (c, next) => {
		const { trustedOrigins } = c.var.config;
		return cors({
			origin: (origin) => (trustedOrigins.includes(origin) ? origin : null),
			credentials: true,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			exposeHeaders: ["set-auth-token"],
			maxAge: 600,
		})(c, next);
	});

	app.onError((error, c) => {
		if (error instanceof HTTPException) {
			const status = error.status;
			return c.json(errorBody(codeForStatus(status), error.message), status);
		}
		console.error(error);
		return c.json(errorBody("internal_error", "Internal server error"), 500);
	});
	app.notFound((c) => c.json(errorBody("not_found", "Not found"), 404));

	app.get("/health", (c) => c.json({ status: "ok", version }, 200));

	// Better Auth: sign-up, sign-in, sign-out, session (native response format).
	const authPath = AUTH_BASE_PATH.slice("/v1".length);
	app.on(["GET", "POST"], `${authPath}/*`, (c) => authOf(c).handler(c.req.raw));

	// OpenAPI docs, outside production only.
	app.use("/docs/*", async (c, next) => {
		if (!c.var.config.isDevelopment) {
			return c.json(errorBody("not_found", "Not found"), 404);
		}
		await next();
	});
	app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
		type: "http",
		scheme: "bearer",
		description: "Session token from the `set-auth-token` header of sign-in",
	});
	app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
		type: "apiKey",
		in: "cookie",
		name: "better-auth.session_token",
		description: "`__Secure-` prefixed in production",
	});
	app.doc31("/docs/json", {
		openapi: "3.1.0",
		info: { title: "Habits API", version },
		security: [{ bearerAuth: [] }, { cookieAuth: [] }],
	});
	app.get("/docs", swaggerUI({ url: "/v1/docs/json" }));

	app.use("*", requireUser);

	return app
		.route("/", habitRoutes)
		.route("/", completionRoutes)
		.route("/", statsRoutes)
		.route("/", settingsRoutes)
		.route("/", pushRoutes);
}

export type AppType = ReturnType<typeof createApp>;
