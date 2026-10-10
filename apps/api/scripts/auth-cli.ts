// Entry point for the Better Auth CLI, which only reads the options to
// generate the Drizzle schema of the auth tables (no database connection):
//
//   pnpm --filter api auth:generate
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { schemaOptions } from "../src/auth/options.ts";

export const auth = betterAuth({
	...schemaOptions,
	// The generator never queries the database.
	database: drizzleAdapter({} as never, { provider: "sqlite" }),
});
