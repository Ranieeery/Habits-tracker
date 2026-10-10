// Shared test helpers: an app with a controllable clock, database resets and
// sign-up/sign-in shortcuts that return the cookie and the bearer token.
import { env } from "cloudflare:workers";
import { createApp } from "../src/app.ts";
import { createDb } from "../src/db/client.ts";
import { rateLimit, user, verification } from "../src/db/schema.ts";

export const db = createDb(env.DB);

/** A password that satisfies `PASSWORD_MIN_LENGTH`. */
export const PASSWORD = "correct-horse-battery-staple";

/** Deletes every user (cascading to all their data) and rate-limit counters. */
export async function resetDb(): Promise<void> {
	await db.batch([
		db.delete(user),
		db.delete(rateLimit),
		db.delete(verification),
	]);
}

/** Inserts a bare Better Auth user, for tests that write rows directly. */
export async function insertUser(id: string): Promise<void> {
	const createdAt = new Date(0);
	await db.insert(user).values({
		id,
		name: "Test",
		email: `${id}@test.local`,
		createdAt,
		updatedAt: createdAt,
	});
}

export type EnvOverrides = Partial<Record<keyof Cloudflare.Env, string>>;

export interface TestApi {
	request(path: string, init?: RequestInit): Promise<Response>;
	/** Moves the injected clock. */
	setNow(iso: string): void;
}

/**
 * The app with a fixed clock (`now` is a UTC ISO instant) and optional binding
 * overrides, e.g. `{ ENVIRONMENT: "production" }`.
 */
export function makeApi(
	now = "2026-10-09T15:00:00Z",
	overrides: EnvOverrides = {}
): TestApi {
	let nowMs = Date.parse(now);
	const app = createApp({ now: () => nowMs });
	return {
		request: async (path, init) =>
			app.request(`http://localhost${path}`, init, { ...env, ...overrides }),
		setNow: (iso) => {
			nowMs = Date.parse(iso);
		},
	};
}

export function json(body: unknown, init: RequestInit = {}): RequestInit {
	return {
		...init,
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json", ...init.headers },
	};
}

export function signUp(
	api: TestApi,
	email: string,
	init: { password?: string; headers?: HeadersInit } = {}
): Promise<Response> {
	return api.request(
		"/v1/auth/sign-up/email",
		json(
			{ name: "Owner", email, password: init.password ?? PASSWORD },
			{ method: "POST", headers: init.headers }
		)
	);
}

export function signIn(
	api: TestApi,
	email: string,
	password = PASSWORD,
	headers: HeadersInit = {}
): Promise<Response> {
	return api.request(
		"/v1/auth/sign-in/email",
		json({ email, password }, { method: "POST", headers })
	);
}

/** `Cookie` header value from a response's `Set-Cookie` headers. */
export function cookieOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

export function bearerOf(response: Response): string {
	const token = response.headers.get("set-auth-token");
	if (!token) throw new Error("Response has no set-auth-token header");
	return token;
}

export interface TestUser {
	id: string;
	email: string;
	cookie: string;
	token: string;
	/** Headers that authenticate as this user (bearer token by default). */
	auth(kind?: "bearer" | "cookie"): Record<string, string>;
}

/** Signs a user up (signup must be allowed) and returns their credentials. */
export async function createUser(
	api: TestApi,
	email: string
): Promise<TestUser> {
	const response = await signUp(api, email);
	if (response.status !== 200) {
		throw new Error(
			`Sign-up failed: ${response.status} ${await response.text()}`
		);
	}
	const body = (await response.json()) as { user: { id: string } };
	const cookie = cookieOf(response);
	const token = bearerOf(response);
	return {
		id: body.user.id,
		email,
		cookie,
		token,
		auth: (kind = "bearer"): Record<string, string> =>
			kind === "bearer"
				? { Authorization: `Bearer ${token}` }
				: { Cookie: cookie },
	};
}
