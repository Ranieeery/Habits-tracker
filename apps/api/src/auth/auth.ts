// Better Auth on D1 through the Drizzle adapter. Built per request because the
// D1 binding comes from `env`.
import { SignUpRequest } from "@habits/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { count } from "drizzle-orm";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import * as schema from "../db/schema.ts";
import type { Clock } from "../lib/clock.ts";
import { ensureSettings } from "../repos/settings.ts";
import { schemaOptions } from "./options.ts";
import { hashPassword, needsRehash, verifyPassword } from "./password.ts";

/** Expo Go / dev client origins; never trusted in production. */
const EXPO_DEV_ORIGINS = ["exp://", "exp://**", "exp://192.168.*.*:*/**"];

/** Scheme of the mobile app (`expo.scheme` in `apps/mobile/app.json`). */
const MOBILE_APP_ORIGIN = "habits://";

export const SIGN_IN_RATE_LIMIT = { window: 60, max: 5 };
export const SIGN_UP_RATE_LIMIT = { window: 60, max: 3 };

interface AuthDeps {
	db: Db;
	config: AppConfig;
	now: Clock;
}

/**
 * Signup is open while no user exists (the owner signs up), optionally only
 * for `OWNER_EMAIL`; afterwards only `ALLOW_SIGNUP=true` reopens it.
 */
async function isSignupAllowed(
	{ db, config }: AuthDeps,
	email: string
): Promise<boolean> {
	if (config.allowSignup) return true;
	const [row] = await db.select({ users: count() }).from(schema.user);
	if ((row?.users ?? 0) > 0) return false;
	return (
		config.ownerEmail === null || config.ownerEmail === email.toLowerCase()
	);
}

export function createAuth(deps: AuthDeps) {
	const { db, config, now } = deps;
	return betterAuth({
		...schemaOptions,
		appName: "Habits",
		secret: config.authSecret,
		baseURL: config.authUrl,
		database: drizzleAdapter(db, { provider: "sqlite", schema }),
		emailAndPassword: {
			...schemaOptions.emailAndPassword,
			autoSignIn: true,
			password: {
				hash: (password) => hashPassword(password),
				verify: ({ hash, password }) => verifyPassword(hash, password),
			},
		},
		trustedOrigins: [
			...config.trustedOrigins,
			MOBILE_APP_ORIGIN,
			...(config.isDevelopment ? EXPO_DEV_ORIGINS : []),
		],
		rateLimit: {
			...schemaOptions.rateLimit,
			enabled: true,
			customRules: {
				"/sign-in/email": SIGN_IN_RATE_LIMIT,
				"/sign-up/email": SIGN_UP_RATE_LIMIT,
			},
		},
		advanced: {
			database: { generateId: () => crypto.randomUUID() },
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
			useSecureCookies: !config.isDevelopment,
			defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						if (!(await isSignupAllowed(deps, user.email))) {
							throw new APIError("FORBIDDEN", {
								code: "SIGNUP_DISABLED",
								message: "Signup is disabled",
							});
						}
					},
					after: async (user) => {
						await ensureSettings(db, user.id, now());
					},
				},
			},
		},
		hooks: {
			// Same rules as the contract, on top of Better Auth's own checks.
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email") return;
				const parsed = SignUpRequest.safeParse(ctx.body);
				if (!parsed.success) {
					throw new APIError("BAD_REQUEST", {
						code: "VALIDATION_ERROR",
						message: parsed.error.issues[0]?.message ?? "Invalid request",
					});
				}
			}),
			// Upgrades a stored hash made with weaker parameters than the current
			// ones, while the plain password is at hand.
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-in/email") return;
				const userId = ctx.context.newSession?.user.id;
				const password: unknown = ctx.body?.password;
				if (!userId || typeof password !== "string") return;
				const account =
					await ctx.context.internalAdapter.findCredentialAccount(userId);
				if (account?.password && needsRehash(account.password)) {
					await ctx.context.internalAdapter.updatePassword(
						userId,
						await hashPassword(password)
					);
				}
			}),
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
