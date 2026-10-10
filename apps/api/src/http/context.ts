import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { type Auth, createAuth } from "../auth/auth.ts";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import type { Clock } from "../lib/clock.ts";
import { validationHook } from "./errors.ts";

export interface AppEnv {
	Bindings: Env;
	Variables: {
		config: AppConfig;
		db: Db;
		now: Clock;
		/** Outgoing requests (push services); injected like the clock. */
		fetch: typeof fetch;
		/** Created on first use by `authOf`. */
		auth: Auth | undefined;
		/** Set by `requireUser`; every query of a route is scoped by it. */
		userId: string;
	};
}

/** Router for a group of routes, with the shared validation error format. */
export function router() {
	return new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
}

/** The request's Better Auth instance (built once per request). */
export function authOf(c: Context<AppEnv>): Auth {
	let auth = c.get("auth");
	if (!auth) {
		auth = createAuth({ db: c.var.db, config: c.var.config, now: c.var.now });
		c.set("auth", auth);
	}
	return auth;
}
