// Public Worker of the app (`habits`): static assets of the PWA, plus `/api/*`
// forwarded to the private API Worker through the `API` service binding, so
// the web app and the API share one origin. Only API paths run this code
// (`run_worker_first` in wrangler.jsonc); every other path is served from the
// assets with the SPA fallback.
import { toApiRequest } from "./gateway.ts";

export default {
	fetch(request, env) {
		const apiRequest = toApiRequest(request);
		return apiRequest ? env.API.fetch(apiRequest) : env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
