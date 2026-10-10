import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/redirect.ts";
import {
	apiError,
	defaultRoutes,
	fakeAuth,
	renderApp,
	USER,
} from "@/test/harness.tsx";

describe("protected routes", () => {
	it("sends visitors without a session to the login, keeping the target", async () => {
		const { router } = renderApp("/habits", { user: null });

		expect(
			await screen.findByRole("heading", { name: "Entrar" })
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/login");
		expect(router.state.location.search).toEqual({ redirect: "/habits" });
		expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
	});

	it("renders the page for a signed-in user", async () => {
		renderApp("/");
		expect(
			await screen.findByRole("heading", { name: "2026" })
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("navigation", { name: "Principal" }).length
		).toBeGreaterThan(0);
	});

	it("goes back to the login when the session expires (401)", async () => {
		const { router } = renderApp("/habits", {
			routes: defaultRoutes({
				"GET /v1/habits": () => apiError(401, "unauthorized"),
			}),
		});

		expect(
			await screen.findByRole("heading", { name: "Entrar" })
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/login");
		expect(router.state.location.search).toEqual({ redirect: "/habits" });
	});

	it("signs in and returns to the requested page", async () => {
		const auth = fakeAuth(null);
		const { router, user } = renderApp("/login?redirect=%2Fsettings", { auth });

		await user.type(await screen.findByLabelText("E-mail"), USER.email);
		await user.type(screen.getByLabelText("Senha"), "habits-dev-password");
		auth.getSession = async () => USER;
		await user.click(screen.getByRole("button", { name: "Entrar" }));

		expect(auth.signIn).toHaveBeenCalledWith({
			email: USER.email,
			password: "habits-dev-password",
		});
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/settings")
		);
		expect(
			await screen.findByRole("heading", { name: "Ajustes" })
		).toBeInTheDocument();
	});

	it("shows a clear error for wrong credentials", async () => {
		const auth = fakeAuth(null);
		const { AuthError } = await import("@/lib/auth.ts");
		auth.signIn = async () => {
			throw new AuthError("invalid_credentials", "nope");
		};
		const { user } = renderApp("/login", { auth });

		await user.type(await screen.findByLabelText("E-mail"), USER.email);
		await user.type(screen.getByLabelText("Senha"), "wrong-password-123");
		await user.click(screen.getByRole("button", { name: "Entrar" }));

		expect(
			await screen.findByText("E-mail ou senha incorretos.")
		).toBeInTheDocument();
	});

	it("redirects a signed-in user away from the login", async () => {
		const { router } = renderApp("/login");
		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
	});

	it("answers unknown dates with not found", async () => {
		renderApp("/day/2026-02-30");
		expect(
			await screen.findByText("Página não encontrada")
		).toBeInTheDocument();
	});
});

describe("safeRedirect", () => {
	it.each([
		[undefined, "/"],
		["/habits", "/habits"],
		["/day/2026-10-01?x=1", "/day/2026-10-01?x=1"],
		["https://evil.test", "/"],
		["//evil.test", "/"],
		["/\\evil.test", "/"],
		["/login?redirect=/", "/"],
	])("%s → %s", (target, expected) => {
		expect(safeRedirect(target)).toBe(expected);
	});
});
