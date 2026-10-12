// 2.2.0 notification settings: morning digest and titles switches
// (optimistic, rolled back on failure) and the reminder time in 15-minute
// steps.
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	apiError,
	defaultRoutes,
	json,
	renderApp,
	SETTINGS,
} from "@/test/harness.tsx";

function routes(patch: (body: Record<string, unknown>) => Response) {
	return defaultRoutes({
		"PATCH /v1/settings": async (request) => {
			const body = (await request.json()) as Record<string, unknown>;
			return patch(body);
		},
	});
}

describe("notification settings", () => {
	it("shows the fixed digest time and turns titles off", async () => {
		const bodies: Record<string, unknown>[] = [];
		const { user } = renderApp("/settings", {
			routes: routes((body) => {
				bodies.push(body);
				return json({ settings: { ...SETTINGS, ...body } });
			}),
		});
		expect(
			await screen.findByRole("switch", { name: /Resumo da manhã \(09:00\)/ })
		).toBeChecked();
		const titles = screen.getByRole("switch", {
			name: /Mostrar nomes nas notificações/,
		});
		expect(titles).toBeChecked();

		await user.click(titles);

		expect(titles).not.toBeChecked();
		await waitFor(() =>
			expect(bodies).toEqual([{ show_titles_in_notifications: false }])
		);
	});

	it("rolls a switch back when saving fails", async () => {
		const { user } = renderApp("/settings", {
			routes: routes(() => apiError(500, "internal_error")),
		});
		const digest = await screen.findByRole("switch", {
			name: /Resumo da manhã/,
		});

		await user.click(digest);

		await waitFor(() => expect(digest).toBeChecked());
		expect(
			await screen.findByText("Não foi possível salvar a preferência")
		).toBeInTheDocument();
	});

	it("offers reminder minutes in 15-minute steps and saves the chosen time", async () => {
		const bodies: Record<string, unknown>[] = [];
		const { user } = renderApp("/settings", {
			routes: defaultRoutes({
				"GET /v1/settings": () =>
					json({ settings: { ...SETTINGS, reminder_time: "20:00" } }),
				"PATCH /v1/settings": async (request) => {
					const body = (await request.json()) as Record<string, unknown>;
					bodies.push(body);
					return json({ settings: { ...SETTINGS, ...body } });
				},
			}),
		});
		const minutes = await screen.findByLabelText("Minutos");
		expect(
			[...(minutes as HTMLSelectElement).options].map((o) => o.value)
		).toEqual(["00", "15", "30", "45"]);

		await user.selectOptions(minutes, "45");
		await user.selectOptions(screen.getByLabelText("Hora"), "21");

		await waitFor(() =>
			expect(bodies).toEqual([
				{ reminder_time: "20:45" },
				{ reminder_time: "21:45" },
			])
		);
	});
});
