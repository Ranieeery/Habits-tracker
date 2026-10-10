import { describe, expect, it } from "vitest";
import { toApiRequest } from "./gateway.ts";

const ORIGIN = "https://habits.example.workers.dev";

describe("toApiRequest", () => {
	it("strips the /api prefix and keeps the query string", () => {
		const forwarded = toApiRequest(
			new Request(`${ORIGIN}/api/v1/summary?year=2026`)
		);
		expect(forwarded?.url).toBe(`${ORIGIN}/v1/summary?year=2026`);
	});

	it("maps /api alone to the root", () => {
		expect(toApiRequest(new Request(`${ORIGIN}/api`))?.url).toBe(`${ORIGIN}/`);
	});

	it("forwards method, headers and body", async () => {
		const forwarded = toApiRequest(
			new Request(`${ORIGIN}/api/v1/auth/sign-in/email`, {
				method: "POST",
				headers: {
					cookie: "__Secure-better-auth.session_token=abc",
					origin: ORIGIN,
					"cf-connecting-ip": "203.0.113.7",
					"content-type": "application/json",
				},
				body: JSON.stringify({ email: "a@b.c", password: "x" }),
			})
		);
		expect(forwarded?.method).toBe("POST");
		expect(forwarded?.headers.get("cookie")).toBe(
			"__Secure-better-auth.session_token=abc"
		);
		expect(forwarded?.headers.get("origin")).toBe(ORIGIN);
		expect(forwarded?.headers.get("cf-connecting-ip")).toBe("203.0.113.7");
		expect(await forwarded?.json()).toEqual({ email: "a@b.c", password: "x" });
	});

	it.each(["/", "/habits", "/day/2026-10-09", "/apix", "/assets/api.js"])(
		"leaves %s to the static assets",
		(path) => {
			expect(toApiRequest(new Request(`${ORIGIN}${path}`))).toBeNull();
		}
	);
});
