// Bindings that `wrangler types` cannot see because they are secrets (set in
// `.dev.vars` locally and with `wrangler secret put` in production).
interface AppSecrets {
	/** Signs sessions and cookies. */
	BETTER_AUTH_SECRET: string;
	/** Public URL of the API, e.g. `http://localhost:8787`. */
	BETTER_AUTH_URL: string;
	/** Optional: the only email allowed to create the owner account. */
	OWNER_EMAIL?: string;
	/**
	 * Web Push (VAPID) keys from `pnpm --filter api vapid:generate`: the public
	 * key (also `VITE_VAPID_PUBLIC_KEY` in apps/web), the private scalar, and a
	 * contact for push services (the app's `https:` URL or a `mailto:`). Without them web devices are skipped.
	 */
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
	/** Optional: Expo access token, only if "enhanced security" is enabled. */
	EXPO_ACCESS_TOKEN?: string;
}

// Merged into both Env declarations of worker-configuration.d.ts.
declare namespace Cloudflare {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface Env extends AppSecrets {}
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env extends AppSecrets {}
