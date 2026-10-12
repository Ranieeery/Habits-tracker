// Ajustes on the web matches the mobile (2.4.0): today's date in the time
// zone section, the device zone saved in one click, and "Sair" asks first.
import type { UserSettings } from "@habits/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	fakeAuth,
	json,
	renderApp,
	SETTINGS,
} from "@/test/harness.tsx";

describe("settings", () => {
	it("says which day it is in the saved time zone", async () => {
		renderApp("/settings");
		expect(
			await screen.findByText("sexta-feira, 9 de outubro")
		).toBeInTheDocument();
		expect(screen.getByText(/Hoje é/)).toBeInTheDocument();
	});

	it("saves the device's time zone in one click", async () => {
		let saved: UserSettings = SETTINGS;
		const { user, requests } = renderApp("/settings", {
			deviceTimeZone: "Europe/Lisbon",
			routes: defaultRoutes({
				"GET /v1/settings": () => json({ settings: saved }),
				"PATCH /v1/settings": async (request) => {
					saved = { ...saved, ...((await request.json()) as object) };
					return json({ settings: saved });
				},
			}),
		});

		await user.click(
			await screen.findByRole("button", {
				name: "Usar o do dispositivo (Europe/Lisbon)",
			})
		);
		await waitFor(() => expect(saved.timezone).toBe("Europe/Lisbon"));
		const patch = requests.find((r) => r.method === "PATCH");
		expect(await patch?.json()).toEqual({ timezone: "Europe/Lisbon" });
	});

	it("asks before signing out, with Cancelar focused", async () => {
		const auth = fakeAuth();
		const { user, router } = renderApp("/settings", { auth });

		await user.click(await screen.findByRole("button", { name: "Sair" }));
		const dialog = await screen.findByRole("alertdialog", {
			name: "Sair da conta?",
		});
		const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
		expect(cancel).toHaveFocus();
		await user.click(cancel);
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
		);
		expect(auth.signOut).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Sair" }));
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Sair",
			})
		);
		await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
	});
});
