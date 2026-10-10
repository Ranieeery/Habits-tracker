interface ImportMetaEnv {
	/** API path or URL without `/v1`, e.g. `/api` (same origin). */
	readonly VITE_API_URL: string;
	/**
	 * Web Push (VAPID) public key, base64url: the API's `VAPID_PUBLIC_KEY`.
	 * Without it, the app shows notifications as unavailable.
	 */
	readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
