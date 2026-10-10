import { ApiError, type ErrorCode } from "@habits/contracts";
import type { Hook } from "@hono/zod-openapi";
import type { AppEnv } from "./context.ts";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

/** HTTP status of each error code. */
export const ERROR_STATUS = {
	validation_error: 422,
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	date_out_of_range: 422,
	signup_disabled: 403,
	rate_limited: 429,
	internal_error: 500,
} as const satisfies Record<ErrorCode, ContentfulStatusCode>;

export function errorBody(
	code: ErrorCode,
	message: string,
	details?: unknown
): ApiError {
	return {
		error:
			details === undefined ? { code, message } : { code, message, details },
	};
}

/** The error code that best describes a bare HTTP status. */
export function codeForStatus(status: number): ErrorCode {
	const code = (Object.keys(ERROR_STATUS) as ErrorCode[]).find(
		(key) => ERROR_STATUS[key] === status
	);
	if (code) return code;
	return status >= 500 ? "internal_error" : "validation_error";
}

/** OpenAPI response entry with a JSON body. */
export function jsonResponse<T extends z.ZodType>(
	schema: T,
	description: string
) {
	return { content: { "application/json": { schema } }, description };
}

/** OpenAPI request body entry: required JSON. */
export function jsonBody<T extends z.ZodType>(schema: T) {
	return { content: { "application/json": { schema } }, required: true };
}

const errorResponse = (description: string) =>
	jsonResponse(ApiError, description);

/** Error responses shared by every authenticated route. */
export const commonErrors = {
	401: errorResponse("No valid session (cookie or bearer token)"),
	422: errorResponse("Invalid request (`validation_error`)"),
};

export const notFoundError = { 404: errorResponse("Not found") };
export const conflictError = {
	409: errorResponse("The id is already used by another record"),
};
export const rateLimitedError = {
	429: errorResponse("Too many requests (`rate_limited`); see `Retry-After`"),
};
export const dateErrors = {
	422: errorResponse(
		"Invalid request (`validation_error`) or date outside the write window (`date_out_of_range`)"
	),
};

/** Turns failed request validation into a 422 `ApiError`. */
export const validationHook: Hook<unknown, AppEnv, string, unknown> = (
	result,
	c
) => {
	if (!result.success) {
		return c.json(
			errorBody("validation_error", "Invalid request", result.error.issues),
			422
		);
	}
};
