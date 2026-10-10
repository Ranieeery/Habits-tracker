import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /v1/health", () => {
	it("returns ok with the app version", async () => {
		const response = await exports.default.fetch(
			"http://example.com/v1/health"
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok", version: "2.0.0" });
	});
});
