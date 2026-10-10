interface ImportMetaEnv {
	/** API path or URL without `/v1`, e.g. `/api` (same origin). */
	readonly VITE_API_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
