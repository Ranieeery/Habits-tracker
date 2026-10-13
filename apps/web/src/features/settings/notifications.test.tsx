// 2.2.0 notification settings: morning digest and titles switches
// (optimistic, rolled back on failure) and the reminder time in 15-minute
// steps.
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	apiError,
	defaultRoutes,
	fakePush,
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

// 2.8.1: turning the digest on used to fail silently when this browser could
// not subscribe or register; now it says so, once.
describe("turning the morning digest on", () => {
	const SUBSCRIPTION = {
		endpoint: "https://push.example.com/browser",
		keys: { p256dh: "p256dh-key", auth: "auth-key" },
	};
	const digestOff = { ...SETTINGS, morning_digest_enabled: false };

	function setup(
		overrides: Parameters<typeof defaultRoutes>[0],
		enable: () =>
			| Promise<never>
			| Promise<{
					status: "subscribed";
					subscription: typeof SUBSCRIPTION;
			  }> = async () => ({ status: "subscribed", subscription: SUBSCRIPTION })
	) {
		return renderApp("/settings", {
			push: fakePush({ support: () => "prompt", enable }),
			routes: defaultRoutes({
				"GET /v1/settings": () => json({ settings: digestOff }),
				...overrides,
			}),
		});
	}

	const digestSwitch = () =>
		screen.findByRole("switch", { name: /Resumo da manhã/ });

	it("says so when this browser cannot subscribe", async () => {
		let patched = false;
		const { user } = setup(
			{
				"PATCH /v1/settings": () => {
					patched = true;
					return json({ settings: SETTINGS });
				},
			},
			async () => {
				throw new DOMException("Push service unavailable", "AbortError");
			}
		);
		const digest = await digestSwitch();
		await user.click(digest);

		expect(
			await screen.findByText("Não foi possível ativar o resumo")
		).toBeInTheDocument();
		expect(digest).not.toBeChecked();
		expect(patched).toBe(false);
	});

	it("says so when registering this browser fails", async () => {
		const { user } = setup({
			"POST /v1/push/subscriptions": () => apiError(500, "internal_error"),
		});
		await user.click(await digestSwitch());

		expect(
			await screen.findByText("Não foi possível ativar o resumo")
		).toBeInTheDocument();
	});

	it("shows one message when saving fails", async () => {
		const { user } = setup({
			"POST /v1/push/subscriptions": () =>
				json({
					subscription: {
						id: "0199c9a0-3333-7000-8000-000000000001",
						kind: "webpush",
						device_label: null,
						last_seen_at: 0,
						created_at: 0,
						updated_at: 0,
					},
				}),
			"PATCH /v1/settings": () => apiError(500, "internal_error"),
		});
		await user.click(await digestSwitch());

		expect(
			await screen.findByText("Não foi possível salvar a preferência")
		).toBeInTheDocument();
		expect(screen.queryByText("Não foi possível ativar o resumo")).toBeNull();
	});
});
