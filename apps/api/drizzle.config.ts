import { defineConfig } from "drizzle-kit";

// Only generates SQL migrations; Wrangler applies them to D1
// (`db:migrate:local` / `db:migrate:remote`).
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./migrations",
});
