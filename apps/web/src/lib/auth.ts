// Session handling through the Better Auth client. The session lives in an
// HttpOnly cookie on the app's own origin; this module never sees the token.
import type { SignInRequest } from "@habits/contracts";
import { createAuthClient } from "better-auth/client";

export interface SessionUser {
	id: string;
	email: string;
	name: string;
}

export type AuthErrorReason =
	"invalid_credentials" | "rate_limited" | "network" | "unknown";

export class AuthError extends Error {
	readonly reason: AuthErrorReason;

	constructor(reason: AuthErrorReason, message: string) {
		super(message);
		this.name = "AuthError";
		this.reason = reason;
	}
}

export interface AuthService {
	/** The signed-in user, or null without a valid session. */
	getSession(): Promise<SessionUser | null>;
	/** Throws `AuthError` on failure. */
	signIn(credentials: SignInRequest): Promise<void>;
	signOut(): Promise<void>;
}

interface BetterAuthError {
	status: number;
	code?: string;
	message?: string;
}

function toAuthError(error: BetterAuthError): AuthError {
	if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
		return new AuthError("invalid_credentials", "Invalid email or password");
	}
	if (error.status === 429) {
		return new AuthError("rate_limited", "Too many attempts");
	}
	if (error.status === 0) return new AuthError("network", "Network error");
	return new AuthError("unknown", error.message ?? `HTTP ${error.status}`);
}

/**
 * `baseURL` is the API base (e.g. `https://app.test/api`); Better Auth is
 * mounted at `/v1/auth` under it.
 */
export function createAuthService(
	apiBaseUrl: string,
	customFetch?: typeof fetch
): AuthService {
	const client = createAuthClient({
		baseURL: `${apiBaseUrl}/v1/auth`,
		fetchOptions: { customFetchImpl: customFetch, credentials: "same-origin" },
	});

	return {
		async getSession() {
			const { data, error } = await client.getSession();
			if (error) {
				if (error.status === 401) return null;
				throw toAuthError(error);
			}
			if (!data) return null;
			const { id, email, name } = data.user;
			return { id, email, name };
		},
		async signIn({ email, password }) {
			try {
				const { error } = await client.signIn.email({ email, password });
				if (error) throw toAuthError(error);
			} catch (error) {
				if (error instanceof AuthError) throw error;
				throw new AuthError("network", "Network error");
			}
		},
		async signOut() {
			await client.signOut();
		},
	};
}
