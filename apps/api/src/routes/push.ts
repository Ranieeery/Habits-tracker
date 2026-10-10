import {
	PushSubscriptionParams,
	PushSubscriptionResponse,
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
} from "../http/errors.ts";
import { uuidV7 } from "../lib/ids.ts";
import {
	deletePushSubscription,
	registerPushSubscription,
	toView,
} from "../repos/push.ts";

const tags = ["push"];

const registerRoute = createRoute({
	method: "post",
	path: "/push/subscriptions",
	tags,
	summary: "Register or refresh a device for push notifications",
	description:
		"Only stores the subscription (sending arrives in Phase 6). The response never includes the endpoint, the keys or the token.",
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
