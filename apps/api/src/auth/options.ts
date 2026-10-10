// Better Auth options that shape the database schema. Shared by the runtime
// config (`auth.ts`) and the schema generator (`scripts/auth-cli.ts`), so the
// generated tables always match what the server uses.
import { expo } from "@better-auth/expo";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@habits/contracts";
import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";

export const AUTH_BASE_PATH = "/v1/auth";

export const schemaOptions = {
	basePath: AUTH_BASE_PATH,
	emailAndPassword: {
		enabled: true,
		minPasswordLength: PASSWORD_MIN_LENGTH,
		maxPasswordLength: PASSWORD_MAX_LENGTH,
	},
	rateLimit: { storage: "database" },
	plugins: [bearer(), expo()],
} satisfies BetterAuthOptions;
