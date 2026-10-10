import { join } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Migrations are read in Node and applied inside workerd by the setup file.
const migrations = await readD1Migrations(
	join(import.meta.dirname, "migrations")
);

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
		}),
	],
	test: {
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
