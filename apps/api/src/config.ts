// Typed view of the Worker bindings that configure the app.
import type { VapidKeys } from "./push/webpush.ts";

export interface AppConfig {
	/** Anything but `"development"` is treated as production. */
	isDevelopment: boolean;
	/** Signup stays open after the owner exists (development only). */
	allowSignup: boolean;
	/** If set, only this email may create the first (owner) account. */
	ownerEmail: string | null;
	/** Browser origins allowed by CORS and Better Auth. */
	trustedOrigins: string[];
	authSecret: string;
	authUrl: string;
	/** Web Push signing keys; null (web devices skipped) when unset. */
	vapid: VapidKeys | null;
	/** Expo "enhanced security" access token, if enabled for the project. */
	expoAccessToken: string | null;
}

export function readConfig(env: Env): AppConfig {
	const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
	return {
		isDevelopment: env.ENVIRONMENT === "development",
		allowSignup: env.ALLOW_SIGNUP === "true",
		ownerEmail: ownerEmail ? ownerEmail : null,
		trustedOrigins: (env.TRUSTED_ORIGINS ?? "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
		authSecret: env.BETTER_AUTH_SECRET,
		authUrl: env.BETTER_AUTH_URL,
		vapid: readVapid(env),
		expoAccessToken: env.EXPO_ACCESS_TOKEN?.trim() || null,
	};
}

function readVapid(env: Env): VapidKeys | null {
	const publicKey = env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = env.VAPID_PRIVATE_KEY?.trim();
	const subject = env.VAPID_SUBJECT?.trim();
	if (!publicKey || !privateKey || !subject) return null;
	return { publicKey, privateKey, subject };
}
