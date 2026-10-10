// Update strategy: a new worker waits until the page asks it to take over
// (the "Nova versão disponível" prompt sends SKIP_WAITING), then it claims
// the open clients so the reload runs the new version.
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("message", (event) => {
	if (
		typeof event.data === "object" &&
		event.data !== null &&
		"type" in event.data &&
		event.data.type === "SKIP_WAITING"
	) {
		void self.skipWaiting();
	}
});

clientsClaim();
