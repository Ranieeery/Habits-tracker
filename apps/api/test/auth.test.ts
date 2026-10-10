import { PASSWORD_MIN_LENGTH } from "@habits/contracts";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { SIGN_IN_RATE_LIMIT, SIGN_UP_RATE_LIMIT } from "../src/auth/auth.ts";
import { user, userSettings } from "../src/db/schema.ts";
import {
	bearerOf,
	cookieOf,
	createUser,
	db,
	makeApi,
	resetDb,
	signIn,
	signUp,
} from "./helpers.ts";

beforeEach(resetDb);

const ORIGIN = { Origin: "http://localhost" };

describe("closed signup", () => {
	it("lets the first user (the owner) sign up, with default settings", async () => {
		const api = makeApi();
		const response = await signUp(api, "owner@example.com");

		expect(response.status).toBe(200);
		const { user: created } = (await response.json()) as {
			user: { id: string };
		};
		expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
		const settings = await db.query.userSettings.findFirst({
			where: eq(userSettings.user_id, created.id),
		});
		expect(settings?.timezone).toBe("America/Sao_Paulo");
	});

	it("blocks every signup after the first user", async () => {
		const api = makeApi();
		await createUser(api, "owner@example.com");

		const response = await signUp(api, "intruder@example.com");

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: "SIGNUP_DISABLED" });
		expect(await db.$count(user)).toBe(1);
	});

	it("reopens with ALLOW_SIGNUP=true", async () => {
		const api = makeApi(undefined, { ALLOW_SIGNUP: "true" });
		await createUser(api, "owner@example.com");

		expect((await signUp(api, "second@example.com")).status).toBe(200);
	});

	it("only accepts OWNER_EMAIL for the first account when it is set", async () => {
		const api = makeApi(undefined, { OWNER_EMAIL: "Owner@Example.com" });

		expect((await signUp(api, "someone@example.com")).status).toBe(403);
		expect((await signUp(api, "owner@example.com")).status).toBe(200);
	});

	it(`rejects passwords shorter than ${PASSWORD_MIN_LENGTH} characters`, async () => {
		const api = makeApi();
		const response = await signUp(api, "owner@example.com", {
			password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
		});

		expect(response.status).toBe(400);
		expect(await db.$count(user)).toBe(0);
	});
});

describe("sessions", () => {
	it("signs in with the right password only", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");

		expect(
			(await signIn(api, owner.email, "wrong-password-123456")).status
		).toBe(401);
		const response = await signIn(api, owner.email);
		expect(response.status).toBe(200);
		expect(bearerOf(response)).toBeTruthy();
		expect(cookieOf(response)).toContain("better-auth.session_token=");
	});

	it("authenticates /v1 routes by cookie and by bearer token", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");

		for (const kind of ["cookie", "bearer"] as const) {
			const response = await api.request("/v1/habits", {
				headers: owner.auth(kind),
			});
			expect(response.status, kind).toBe(200);
		}
	});

	it.each([
		["no credentials", {}],
		["an invalid bearer token", { Authorization: "Bearer not-a-token" }],
		["an invalid cookie", { Cookie: "better-auth.session_token=forged" }],
	])("answers 401 to %s", async (_, headers: Record<string, string>) => {
		const api = makeApi();
		await createUser(api, "owner@example.com");

		const response = await api.request("/v1/habits", { headers });

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: { code: "unauthorized", message: "Authentication required" },
		});
	});

	it("guards every non-public route, unknown paths included", async () => {
		const api = makeApi();
		for (const path of [
			"/v1/habits",
			"/v1/day?date=2026-10-09",
			"/v1/summary?year=2026",
			"/v1/settings",
			"/v1/unknown",
		]) {
			expect((await api.request(path)).status, path).toBe(401);
		}
		expect((await api.request("/v1/health")).status).toBe(200);
	});

	it("signs out, invalidating the cookie and the bearer token", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");

		const response = await api.request("/v1/auth/sign-out", {
			method: "POST",
			headers: { ...owner.auth("cookie"), ...ORIGIN },
		});
		expect(response.status).toBe(200);

		for (const kind of ["cookie", "bearer"] as const) {
			const after = await api.request("/v1/habits", {
				headers: owner.auth(kind),
			});
			expect(after.status, kind).toBe(401);
		}
	});

	it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
		const api = makeApi();
		const response = await signUp(api, "owner@example.com");
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.includes("session_token="));

		expect(cookie).toMatch(/HttpOnly/i);
		expect(cookie).toMatch(/SameSite=Lax/i);
	});

	it("marks the cookie Secure (with the __Secure- prefix) in production", async () => {
		const api = makeApi(undefined, {
			ENVIRONMENT: "production",
			BETTER_AUTH_URL: "https://habits.example.com",
		});
		const response = await signUp(api, "owner@example.com", {
			headers: { Origin: "https://habits.example.com" },
		});
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.includes("session_token="));

		expect(cookie).toMatch(/^__Secure-better-auth\.session_token=/);
		expect(cookie).toMatch(/; Secure/i);
	});
});

describe("rate limiting", () => {
	const ip = { "cf-connecting-ip": "203.0.113.7" };

	it(`allows ${SIGN_IN_RATE_LIMIT.max} sign-in attempts per window`, async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");

		for (let i = 0; i < SIGN_IN_RATE_LIMIT.max; i++) {
			const response = await signIn(
				api,
				owner.email,
				"wrong-password-123456",
				ip
			);
			expect(response.status).toBe(401);
		}
		const blocked = await signIn(api, owner.email, undefined, ip);
		expect(blocked.status).toBe(429);
	});

	it(`allows ${SIGN_UP_RATE_LIMIT.max} sign-up attempts per window`, async () => {
		const api = makeApi(undefined, { ALLOW_SIGNUP: "true" });

		for (let i = 0; i < SIGN_UP_RATE_LIMIT.max; i++) {
			const response = await signUp(api, `user${i}@example.com`, {
				headers: ip,
			});
			expect(response.status).toBe(200);
		}
		const blocked = await signUp(api, "one-more@example.com", { headers: ip });
		expect(blocked.status).toBe(429);
	});
});
