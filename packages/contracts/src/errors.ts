import { z } from "zod";

export const ERROR_CODES = [
	"validation_error",
	"unauthorized",
	"forbidden",
	"not_found",
	"conflict",
	"date_out_of_range",
	"signup_disabled",
	"rate_limited",
	"internal_error",
] as const;

/** Codes the server emits. */
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z.object({
	/**
	 * One of `ERROR_CODES`. Kept as a plain string so older clients accept
	 * codes added later.
	 */
	code: z.string(),
	message: z.string(),
	details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const ApiError = z.object({ error: ApiErrorBody });
export type ApiError = z.infer<typeof ApiError>;
