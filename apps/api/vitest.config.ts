import { randomBytes } from "node:crypto";
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
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: migrations,
					// Tests run as development; a test passes ENVIRONMENT=production
					// to check production behavior. The secret is random per run, so
					// none is committed.
					ENVIRONMENT: "development",
					ALLOW_SIGNUP: "false",
					TRUSTED_ORIGINS: "http://localhost:5173",
					BETTER_AUTH_URL: "http://localhost",
					BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
				},
			},
		}),
	],
	test: {
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
