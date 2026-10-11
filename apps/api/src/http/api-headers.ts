import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context.ts";

/**
 * Headers on every API response, Better Auth's included. Responses carry
 * per-user data or session cookies, so no browser, proxy or service worker
 * may store them. The web's `_headers` file does not reach these responses:
 * it only applies to static assets.
 */
export const API_HEADERS = {
	"Cache-Control": "no-store",
	"X-Content-Type-Options": "nosniff",
} as const;

export const apiHeaders = createMiddleware<AppEnv>(async (c, next) => {
	await next();
	try {
		for (const [name, value] of Object.entries(API_HEADERS)) {
			c.res.headers.set(name, value);
		}
	} catch {
		// Immutable headers (a response passed through as is): copy it.
		const response = new Response(c.res.body, c.res);
		for (const [name, value] of Object.entries(API_HEADERS)) {
			response.headers.set(name, value);
		}
		c.res = response;
	}
});
