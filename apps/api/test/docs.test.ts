import { ApiError } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import { makeApi } from "./helpers.ts";

describe("OpenAPI docs", () => {
	it("serves the document and the UI outside production", async () => {
		const api = makeApi();

		const document = await api.request("/v1/docs/json");
		expect(document.status).toBe(200);
		const spec = (await document.json()) as {
			openapi: string;
			paths: Record<string, unknown>;
		};
		expect(spec.openapi).toBe("3.1.0");
		expect(Object.keys(spec.paths).sort()).toEqual([
			"/v1/day",
			"/v1/habits",
			"/v1/habits/{habit_id}",
			"/v1/habits/{habit_id}/completions/{date}",
			"/v1/push/subscriptions",
			"/v1/push/subscriptions/{subscription_id}",
			"/v1/push/test",
			"/v1/settings",
			"/v1/summary",
			"/v1/sync/pull",
			"/v1/sync/push",
		]);

		const ui = await api.request("/v1/docs");
		expect(ui.status).toBe(200);
		expect(ui.headers.get("content-type")).toContain("text/html");
	});

	it("is not served in production", async () => {
		const api = makeApi(undefined, { ENVIRONMENT: "production" });
		for (const path of ["/v1/docs", "/v1/docs/json"]) {
			const response = await api.request(path);
			expect(response.status, path).toBe(404);
			expect(ApiError.safeParse(await response.json()).success).toBe(true);
		}
	});
});

describe("CORS", () => {
	it("allows only the trusted origins, with credentials", async () => {
		const api = makeApi();
		const preflight = (origin: string) =>
			api.request("/v1/habits", {
				method: "OPTIONS",
				headers: {
					Origin: origin,
					"Access-Control-Request-Method": "POST",
				},
			});

		const trusted = await preflight("http://localhost:5173");
		expect(trusted.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:5173"
		);
		expect(trusted.headers.get("access-control-allow-credentials")).toBe(
			"true"
		);

		const other = await preflight("https://evil.example.com");
		expect(other.headers.get("access-control-allow-origin")).toBeNull();
	});
});
