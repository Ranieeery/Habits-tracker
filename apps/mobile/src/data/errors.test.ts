import { ApiClientError } from "@habits/api-client";
import { describe, expect, it } from "vitest";
import {
	DataError,
	errorMessage,
	isUnauthorized,
	toDataError,
} from "./errors.ts";

describe("toDataError", () => {
	it("maps API error codes to kinds", () => {
		const cases = [
			[new ApiClientError(422, "validation_error", "x"), "invalid"],
			[new ApiClientError(404, "not_found", "x"), "not_found"],
			[new ApiClientError(422, "date_out_of_range", "x"), "out_of_range"],
			[new ApiClientError(429, "rate_limited", "x"), "rate_limited"],
			[new ApiClientError(500, "internal_error", "x"), "unknown"],
			[new ApiClientError(502, "unknown", "x"), "unknown"],
		] as const;
		for (const [error, kind] of cases) {
			expect(toDataError(error).kind).toBe(kind);
		}
	});

	it("treats any 401 as unauthorized, whatever the body", () => {
		const error = toDataError(new ApiClientError(401, "unknown", "x"));
		expect(error.kind).toBe("unauthorized");
		expect(isUnauthorized(error)).toBe(true);
		expect(isUnauthorized(new ApiClientError(401, "unauthorized", "x"))).toBe(
			false
		);
	});

	it("maps fetch network failures to offline", () => {
		const error = toDataError(new TypeError("Network request failed"));
		expect(error.kind).toBe("offline");
		expect(error.cause).toBeInstanceOf(TypeError);
	});

	it("keeps DataErrors and wraps anything else as unknown", () => {
		const original = new DataError("not_found", "x");
		expect(toDataError(original)).toBe(original);
		expect(toDataError("boom").kind).toBe("unknown");
	});
});

describe("errorMessage", () => {
	it("speaks pt-BR for every source of error", () => {
		expect(errorMessage(new TypeError("fail"))).toBe(
			"Sem conexão com o servidor. Verifique sua internet."
		);
		expect(
			errorMessage(new ApiClientError(422, "date_out_of_range", "x"))
		).toBe("Essa data não pode mais ser alterada.");
		expect(errorMessage(new Error("?"))).toBe(
			"Algo deu errado. Tente de novo."
		);
	});
});
