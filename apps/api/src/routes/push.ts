import {
	PushSubscriptionParams,
	PushSubscriptionResponse,
	PushTestResponse,
	RegisterPushSubscriptionRequest,
} from "@habits/contracts";
import { createRoute } from "@hono/zod-openapi";
import { router } from "../http/context.ts";
import {
	commonErrors,
	conflictError,
	errorBody,
	jsonBody,
	jsonResponse,
	notFoundError,
	rateLimitedError,
} from "../http/errors.ts";
import { uuidV7 } from "../lib/ids.ts";
import { createDispatcher, withinFetchLimit } from "../push/dispatch.ts";
import {
	deletePushSubscription,
	listPushTargets,
	registerPushSubscription,
	toView,
} from "../repos/push.ts";
import { claimTestPush } from "../repos/reminders.ts";

/** One test notification per user per minute. */
export const TEST_PUSH_INTERVAL_MS = 60_000;
/** Under the Free plan's 50 subrequests per request. */
const MAX_TEST_FETCHES = 40;

const tags = ["push"];

const registerRoute = createRoute({
	method: "post",
	path: "/push/subscriptions",
	tags,
	summary: "Register or refresh a device for push notifications",
	description:
		"Upserts by endpoint (web push) or token (expo). The response never includes the endpoint, the keys or the token.",
	request: { body: jsonBody(RegisterPushSubscriptionRequest) },
	responses: {
		200: jsonResponse(PushSubscriptionResponse, "Registered"),
		...commonErrors,
		...conflictError,
	},
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/push/subscriptions/{subscription_id}",
	tags,
	summary: "Remove a device",
	request: { params: PushSubscriptionParams },
	responses: {
		204: { description: "Removed" },
		...commonErrors,
		...notFoundError,
	},
});

const testRoute = createRoute({
	method: "post",
	path: "/push/test",
	tags,
	summary: "Send a test notification to all of the user's devices",
	description:
		"Rate limited to one per minute per user. Answers counts only: devices reached, failed temporarily, and removed because the push service no longer knows them.",
	responses: {
		200: jsonResponse(PushTestResponse, "Sent"),
		...commonErrors,
		...rateLimitedError,
	},
});

export const pushRoutes = router()
	.openapi(registerRoute, async (c) => {
		const body = c.req.valid("json");
		const now = c.var.now();
		const subscription = await registerPushSubscription(
			c.var.db,
			c.var.userId,
			body,
			body.id ?? uuidV7(now),
			now
		);
		if (!subscription) {
			return c.json(
				errorBody("conflict", "Subscription id already in use"),
				409
			);
		}
		return c.json({ subscription: toView(subscription) }, 200);
	})
	.openapi(testRoute, async (c) => {
		const now = c.var.now();
		const userId = c.var.userId;
		if (!(await claimTestPush(c.var.db, userId, now, TEST_PUSH_INTERVAL_MS))) {
			c.header("Retry-After", String(TEST_PUSH_INTERVAL_MS / 1000));
			return c.json(
				errorBody("rate_limited", "Wait a minute before another test"),
				429
			);
		}
		// Within the subrequest limit (first registered devices first).
		const targets = withinFetchLimit(
			await listPushTargets(c.var.db, userId),
			MAX_TEST_FETCHES
		);
		const send = createDispatcher({
			db: c.var.db,
			fetch: c.var.fetch,
			now,
			vapid: c.var.config.vapid,
			expoAccessToken: c.var.config.expoAccessToken,
		});
		const result = await send(userId, targets, {
			kind: "test",
			title: "Habits",
			body: "Notificações funcionando neste aparelho.",
			tag: "test",
			ttl: 60 * 60,
		});
		return c.json(result, 200);
	})
	.openapi(deleteRoute, async (c) => {
		const { subscription_id } = c.req.valid("param");
		const deleted = await deletePushSubscription(
			c.var.db,
			c.var.userId,
			subscription_id
		);
		if (!deleted) {
			return c.json(errorBody("not_found", "Subscription not found"), 404);
		}
		return c.body(null, 204);
	});
