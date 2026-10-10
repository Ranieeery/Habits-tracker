// Session handling through the Better Auth client with its Expo plugin. The
// session cookie lives only in expo-secure-store (Android Keystore), written
// and cleared by the plugin. Never log it or copy it elsewhere.
import { expoClient } from "@better-auth/expo/client";
import type { SignInRequest } from "@habits/contracts";
import { createAuthClient } from "better-auth/client";
import * as SecureStore from "expo-secure-store";

export interface SessionUser {
	id: string;
	email: string;
	name: string;
}

export type SessionState =
	| { status: "signed_out" }
	/**
	 * `user` is null when the server could not be reached but a session is
	 * stored: the app opens and its screens show the offline state.
	 */
	| { status: "signed_in"; user: SessionUser | null };

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
	/** Restores the stored session, checking it with the server when online. */
	restoreSession(): Promise<SessionState>;
	/** Throws `AuthError` on failure. */
	signIn(credentials: SignInRequest): Promise<SessionUser>;
	/** Clears the stored session first, then revokes it on the server. */
	signOut(): Promise<void>;
	/** `Cookie` header value for API requests ("" when signed out). */
	getCookie(): Promise<string>;
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

/** Matches `expo.scheme` in app.json; the API trusts `habits://`. */
const APP_SCHEME = "habits";

/** `apiBaseUrl` is the API base without `/v1`; Better Auth is at `/v1/auth`. */
export function createAuthService(apiBaseUrl: string): AuthService {
	const client = createAuthClient({
		baseURL: `${apiBaseUrl}/v1/auth`,
		plugins: [
			expoClient({
				scheme: APP_SCHEME,
				storagePrefix: "habits",
				storage: SecureStore,
			}),
		],
	});

	// Every API request needs the cookie. Reading it from SecureStore each
	// time is slow on Android (Keystore) and the plugin serializes those reads,
	// so concurrent requests queued behind each other. Keep it in memory and
	// re-read only when the plugin reports a session cookie change (sign-in,
	// renewal, sign-out) or after our own auth calls.
	let cookie: Promise<string> | null = null;
	const readCookie = () => {
		cookie ??= client.getCookie().catch((error: unknown) => {
			cookie = null;
			throw error;
		});
		return cookie;
	};
	const forgetCookie = () => {
		cookie = null;
	};
	client.$store.listen("$sessionSignal", forgetCookie);

	const pick = ({ id, email, name }: SessionUser): SessionUser => ({
		id,
		email,
		name,
	});

	return {
		async restoreSession() {
			const stored = await readCookie();
			if (!stored) return { status: "signed_out" };
			try {
				const { data, error } = await client.getSession();
				// get-session may have renewed the cookie.
				forgetCookie();
				if (!error) {
					return data
						? { status: "signed_in", user: pick(data.user) }
						: { status: "signed_out" };
				}
				if (error.status === 401) return { status: "signed_out" };
			} catch {
				// Unreachable server: fall through to the stored session.
			}
			return { status: "signed_in", user: null };
		},
		async signIn({ email, password }) {
			let result: Awaited<ReturnType<typeof client.signIn.email>>;
			try {
				result = await client.signIn.email({ email, password });
			} catch {
				throw new AuthError("network", "Network error");
			} finally {
				forgetCookie();
			}
			if (result.error) throw toAuthError(result.error);
			return pick(result.data.user);
		},
		async signOut() {
			try {
				await client.signOut();
			} catch {
				// Offline: the plugin already cleared the stored session before
				// sending the request; the server session expires on its own.
			} finally {
				forgetCookie();
			}
		},
		getCookie: readCookie,
	};
}
