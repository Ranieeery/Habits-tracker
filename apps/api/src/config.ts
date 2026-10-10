// Typed view of the Worker bindings that configure the app.

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
	};
}
