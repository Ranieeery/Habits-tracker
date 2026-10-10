import { z } from "zod";

/** Passwords are long because the server hash is deliberately lightweight. */
export const PASSWORD_MIN_LENGTH = 16;
export const PASSWORD_MAX_LENGTH = 128;

export const Password = z
	.string()
	.min(PASSWORD_MIN_LENGTH)
	.max(PASSWORD_MAX_LENGTH);
export type Password = z.infer<typeof Password>;

export const Email = z.email().max(254);

/** Body of `POST /v1/auth/sign-up/email` (served by Better Auth). */
export const SignUpRequest = z.object({
	name: z.string().trim().min(1).max(120),
	email: Email,
	password: Password,
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

/** Body of `POST /v1/auth/sign-in/email` (served by Better Auth). */
export const SignInRequest = z.object({
	email: Email,
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type SignInRequest = z.infer<typeof SignInRequest>;
