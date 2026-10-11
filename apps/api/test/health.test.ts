import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { version } from "../package.json";

describe("GET /v1/health", () => {
	it("returns ok with the app version", async () => {
		const response = await exports.default.fetch(
			"http://example.com/v1/health"
		);

		expect(response.status).toBe(200);
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(await response.json()).toEqual({ status: "ok", version });
	});
});
