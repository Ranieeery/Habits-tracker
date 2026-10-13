// Vite's `import.meta.glob`, which Vitest supports, for tests only (the app
// has no vite/client types; Metro never sees test files).
interface ImportMeta {
	glob<T>(
		patterns: string | string[],
		options: { query: "?raw"; import: "default"; eager: true }
	): Record<string, T>;
}
