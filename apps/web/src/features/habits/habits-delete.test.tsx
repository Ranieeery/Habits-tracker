// Deleting habits (2.11.0): only archived habits, after an alert dialog with
// Cancelar focused; the habit leaves at once, "Desfazer" restores it, a
// failure puts it back, and days and heatmaps refetch.
import type { Habit } from "@habits/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/queries.ts";
import {
	apiError,
	defaultRoutes,
	habit,
	json,
	renderApp,
} from "@/test/harness.tsx";

const ids = {
	ler: "0199c9a0-5555-7000-8000-000000000001",
	antigo: "0199c9a0-5555-7000-8000-000000000002",
};
const ARCHIVED_AT = Date.parse("2026-10-05T15:00:00Z");

function server(options: { failDelete?: "conflict" } = {}) {
	const habits: Habit[] = [
		habit({ id: ids.ler, name: "Ler", sort_key: "a0" }),
		habit({
			id: ids.antigo,
			name: "Antigo",
			sort_key: "a1",
			archived_at: ARCHIVED_AT,
		}),
	];
	const routes = defaultRoutes({
		"GET /v1/habits": () =>
			json({ habits: habits.filter((h) => h.deleted_at === null) }),
	});
	for (const item of habits) {
		routes[`DELETE /v1/habits/${item.id}`] = () => {
			if (options.failDelete) return apiError(409, "conflict");
			item.deleted_at ??= Date.parse("2026-10-09T15:00:00Z");
			return json({ habit: item });
		};
		routes[`POST /v1/habits/${item.id}/restore`] = () => {
			item.deleted_at = null;
			return json({ habit: item });
		};
	}
	return { routes, habits };
}

async function open(options?: { failDelete?: "conflict" }) {
	const { routes, habits } = server(options);
	const app = renderApp("/habits", { routes });
	await screen.findByRole("list", { name: "Hábitos ativos" });
	await app.user.click(screen.getByText(/Arquivados/));
	return { ...app, habits };
}

const deletes = (requests: Request[]) =>
	requests.filter((r) => r.method === "DELETE");

describe("deleting a habit", () => {
	it("is offered only for archived habits", async () => {
		await open();
		expect(
			screen.getByRole("button", { name: "Apagar Antigo" })
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Apagar Ler" })).toBeNull();
		const active = screen.getByRole("list", { name: "Hábitos ativos" });
		expect(within(active).queryByRole("button", { name: /Apagar/ })).toBeNull();
	});

	it("asks first, with Cancelar focused; Cancelar and Esc keep the habit", async () => {
		const { user, requests } = await open();

		await user.click(screen.getByRole("button", { name: "Apagar Antigo" }));
		const dialog = await screen.findByRole("alertdialog", {
			name: "Apagar hábito?",
		});
		expect(dialog).toHaveTextContent("todo o histórico dele saem do mapa");
		expect(
			within(dialog).getByRole("button", { name: "Cancelar" })
		).toHaveFocus();
		await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

		await user.click(screen.getByRole("button", { name: "Apagar Antigo" }));
		await screen.findByRole("alertdialog");
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

		expect(deletes(requests)).toHaveLength(0);
		expect(screen.getByText("Antigo")).toBeInTheDocument();
	});

	it("removes it at once and Desfazer restores it", async () => {
		const { user, requests, habits } = await open();

		await user.click(screen.getByRole("button", { name: "Apagar Antigo" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Apagar" }));

		// The card is gone (the toast also says "Antigo").
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "Apagar Antigo" })).toBeNull()
		);
		expect(deletes(requests).map((r) => r.url)).toEqual([
			expect.stringMatching(new RegExp(`/v1/habits/${ids.antigo}$`)),
		]);
		expect(await screen.findByText("Hábito apagado")).toBeInTheDocument();
		expect(habits[1]?.deleted_at).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Desfazer" }));

		await screen.findByText("Hábito restaurado");
		expect(habits[1]?.deleted_at).toBeNull();
		expect(
			await screen.findByRole("button", { name: "Apagar Antigo" })
		).toBeInTheDocument();
		expect(
			requests.some(
				(r) =>
					r.method === "POST" &&
					r.url.endsWith(`/v1/habits/${ids.antigo}/restore`)
			)
		).toBe(true);
	});

	it("puts it back and says why when the server refuses", async () => {
		const { user } = await open({ failDelete: "conflict" });

		await user.click(screen.getByRole("button", { name: "Apagar Antigo" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Apagar" }));

		expect(
			await screen.findByText("Só dá para apagar um hábito arquivado.")
		).toBeInTheDocument();
		expect(
			screen.getByText("Não foi possível apagar o hábito")
		).toBeInTheDocument();
		expect(await screen.findByText("Antigo")).toBeInTheDocument();
	});

	it("refetches days and heatmaps (a deleted habit leaves past days)", async () => {
		const { user, router } = await open();
		const { queryClient } = router.options.context;
		queryClient.setQueryData(queryKeys.summary(2026), { year: 2026, days: [] });
		queryClient.setQueryData(queryKeys.day("2026-10-05"), {
			date: "2026-10-05",
			possible_habits: [],
			completed_habit_ids: [],
		});

		await user.click(screen.getByRole("button", { name: "Apagar Antigo" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Apagar" }));

		await waitFor(() => {
			expect(
				queryClient.getQueryState(queryKeys.summary(2026))?.isInvalidated
			).toBe(true);
			expect(
				queryClient.getQueryState(queryKeys.day("2026-10-05"))?.isInvalidated
			).toBe(true);
		});
	});
});
