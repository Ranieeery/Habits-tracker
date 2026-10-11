import { ApiClientError } from "@habits/api-client";
import { describe, expect, it } from "vitest";
import {
	classifyFailure,
	parseRetryAfter,
	TransportError,
} from "./transport.ts";

describe("classifyFailure", () => {
	it.each([
		[500, "transient"],
		[503, "transient"],
		[429, "transient"],
		[408, "transient"],
		[401, "unauthorized"],
		[422, "rejected"],
		[413, "rejected"],
		[404, "rejected"],
	])("HTTP %i is %s", (status, kind) => {
		const error = new ApiClientError(status, "x", "message");
		expect(classifyFailure(error).kind).toBe(kind);
	});

	it("keeps Retry-After for transient errors and the body for rejections", () => {
		expect(
			classifyFailure(new ApiClientError(429, "rate_limited", "slow"), 30_000)
		).toEqual({ kind: "transient", status: 429, retryAfterMs: 30_000 });
		expect(
			classifyFailure(new ApiClientError(422, "validation_error", "bad", [1]))
		).toEqual({
			kind: "rejected",
			status: 422,
			error: { code: "validation_error", message: "bad", details: [1] },
		});
	});

	it("treats network errors and timeouts as offline", () => {
		expect(classifyFailure(new TypeError("Network request failed")).kind).toBe(
			"offline"
		);
		const abort = new Error("aborted");
		abort.name = "AbortError";
		expect(classifyFailure(abort).kind).toBe("offline");
	});

	it("passes TransportError through and treats the unknown as transient", () => {
		expect(
			classifyFailure(new TransportError({ kind: "unauthorized" }))
		).toEqual({
			kind: "unauthorized",
		});
		expect(classifyFailure(new Error("?")).kind).toBe("transient");
	});
});

describe("parseRetryAfter", () => {
	const now = Date.parse("2026-10-09T15:00:00Z");
	it("reads seconds and HTTP dates", () => {
		expect(parseRetryAfter("60", now)).toBe(60_000);
		expect(parseRetryAfter("Fri, 09 Oct 2026 15:01:30 GMT", now)).toBe(90_000);
		expect(parseRetryAfter(null, now)).toBeNull();
		expect(parseRetryAfter("soon", now)).toBeNull();
	});
});
