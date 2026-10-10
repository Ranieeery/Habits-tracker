import { createApp } from "./app.ts";
import { runScheduled } from "./scheduled.ts";

// The only place that reads the real clock (see `lib/clock.ts`); the cron uses
// its scheduled time instead.
const app = createApp({ now: () => Date.now() });

export default {
	fetch: app.fetch,
	scheduled(controller, env, ctx) {
		ctx.waitUntil(
			runScheduled({
				env,
				now: controller.scheduledTime,
				fetch: (input, init) => fetch(input, init),
			})
		);
	},
} satisfies ExportedHandler<Env>;
