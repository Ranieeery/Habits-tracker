import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	json,
	renderApp,
	SETTINGS,
	TIME_ZONE,
} from "@/test/harness.tsx";

const BANNER = { name: "Fuso horário diferente" };

describe("TimezoneBanner", () => {
	it("stays hidden when the device matches the saved zone", async () => {
		renderApp("/habits", { deviceTimeZone: TIME_ZONE });
		await screen.findByRole("heading", { name: "Hábitos" });
		expect(screen.queryByRole("complementary", BANNER)).not.toBeInTheDocument();
	});

	it("warns about a different device zone without changing it", async () => {
		const { requests } = renderApp("/habits", {
			deviceTimeZone: "Europe/Lisbon",
		});

		const banner = await screen.findByRole("complementary", BANNER);
		expect(banner).toHaveTextContent("Este dispositivo está em Europe/Lisbon");
		expect(banner).toHaveTextContent(TIME_ZONE);
		expect(requests.some((request) => request.method === "PATCH")).toBe(false);
	});

	it("updates the saved zone when asked", async () => {
		let saved = TIME_ZONE;
		const { user, requests } = renderApp("/habits", {
			deviceTimeZone: "Europe/Lisbon",
			routes: defaultRoutes({
				"GET /v1/settings": () =>
					json({ settings: { ...SETTINGS, timezone: saved } }),
				"PATCH /v1/settings": async (request) => {
					const body = (await request.json()) as { timezone: string };
					saved = body.timezone;
					return json({ settings: { ...SETTINGS, timezone: saved } });
				},
			}),
		});

		await user.click(
			await screen.findByRole("button", {
				name: "Atualizar para Europe/Lisbon",
			})
		);

		const patch = requests.find((request) => request.method === "PATCH");
		expect(await patch?.json()).toEqual({ timezone: "Europe/Lisbon" });
		await waitFor(() =>
			expect(
				screen.queryByRole("complementary", BANNER)
			).not.toBeInTheDocument()
		);
	});

	it("can be dismissed for this pair of zones", async () => {
		const { user, requests } = renderApp("/habits", {
			deviceTimeZone: "Europe/Lisbon",
		});

		await user.click(await screen.findByRole("button", { name: "Manter" }));

		expect(screen.queryByRole("complementary", BANNER)).not.toBeInTheDocument();
		expect(
			localStorage.getItem(`habits:tz-dismissed:Europe/Lisbon|${TIME_ZONE}`)
		).toBe("1");
		expect(requests.some((request) => request.method === "PATCH")).toBe(false);
	});
});
