// Precaches the app shell (the build's JS, CSS, HTML, icons and fonts) and
// serves index.html for client-side routes. Nothing else is cached: API
// responses are authenticated and always go to the network.
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
	new NavigationRoute(createHandlerBoundToURL("index.html"), {
		denylist: [/^\/api(\/|$)/],
	})
);
