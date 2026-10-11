import { beforeEach, describe, expect, it } from "vitest";
import { API_HEADERS } from "../src/http/api-headers.ts";
import { createUser, makeApi, resetDb, signUp } from "./helpers.ts";

function expectApiHeaders(response: Response) {
	for (const [name, value] of Object.entries(API_HEADERS)) {
		expect(response.headers.get(name), name).toBe(value);
	}
}

describe("API response headers", () => {
	beforeEach(resetDb);

	it("are on authenticated routes", async () => {
		const api = makeApi();
		const user = await createUser(api, "owner@example.com");
		const response = await api.request("/v1/habits", {
			headers: user.auth(),
		});
		expect(response.status).toBe(200);
		expectApiHeaders(response);
	});

	it("are on Better Auth responses", async () => {
		const response = await signUp(makeApi(), "owner@example.com");
		expect(response.status).toBe(200);
		expectApiHeaders(response);
	});

	it("are on health, 401, 404 and production responses", async () => {
		const api = makeApi(undefined, { ENVIRONMENT: "production" });
		for (const path of ["/v1/health", "/v1/habits", "/v1/docs"]) {
			const response = await api.request(path);
			expectApiHeaders(response);
		}
	});
});
