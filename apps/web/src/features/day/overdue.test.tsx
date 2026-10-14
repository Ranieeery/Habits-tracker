// Overdue fixed-day habits (2.8.0): on top of today's list with a badge (day
// view and the heatmap's "Hoje" panel), marked like any habit, absent on
// other days. TODAY = Friday 2026-10-09.
import type { DayResponse } from "@habits/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const read = habit({ id: "0199c9a0-1111-7000-8000-000000000001", name: "Ler" });
const condo = habit({
	id: "0199c9a0-1111-7000-8000-000000000002",
	name: "Pagar condomínio",
	schedule: { type: "monthly_days", days: [5] },
});
const CONDO_NAME = "Pagar condomínio, atrasado desde 5 de outubro";

/**
 * A fake API that answers like the real one: the overdue list only on
 * today, and a habit marked today also among the possible ones.
 */
function overdueRoutes(initial: string[] = [], possible = [read]) {
	let completed = [...initial];
	const puts: { completed: boolean }[] = [];
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits: [read, condo] }),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? "";
			if (date !== TODAY) {
				return json({
					date,
					possible_habits: possible,
					completed_habit_ids: [],
				} satisfies DayResponse);
			}
			const condoDone = completed.includes(condo.id);
			return json({
				date,
				possible_habits: condoDone ? [...possible, condo] : possible,
				completed_habit_ids: completed,
				overdue: [
					{ habit: condo, since: "2026-10-05", completed_today: condoDone },
				],
			} satisfies DayResponse);
		},
		[`PUT /v1/habits/${condo.id}/completions/${TODAY}`]: async (request) => {
			const body = (await request.json()) as { completed: boolean };
			puts.push(body);
			completed = body.completed
				? [...completed, condo.id]
				: completed.filter((id) => id !== condo.id);
			return json({ completion: null });
		},
	});
	return { routes, puts };
}

describe("overdue habits on today", () => {
	it("come first with a badge that is read with the date", async () => {
		const { routes } = overdueRoutes();
		renderApp("/today", { routes });

		const box = await screen.findByRole("checkbox", { name: CONDO_NAME });
		expect(box).not.toBeChecked();
		const boxes = screen.getAllByRole("checkbox");
		expect(boxes[0]).toBe(box);
		expect(boxes[1]).toHaveAccessibleName("Ler");
		expect(screen.getByText("Atrasado desde 05/10")).toBeInTheDocument();
		// A pending overdue habit is not counted today.
		expect(screen.getByText("0 de 1 concluídos (0%)")).toBeInTheDocument();
		expect(boxes).toHaveLength(2);
	});

	it("is marked with today's date, stays in place, and undo brings it back", async () => {
		const { routes, puts } = overdueRoutes();
		const { user } = renderApp("/today", { routes });

		const box = await screen.findByRole("checkbox", { name: CONDO_NAME });
		await user.click(box);
		expect(box).toBeChecked();
		expect(screen.getByText("1 de 2 concluídos (50%)")).toBeInTheDocument();
		await waitFor(() => expect(puts).toEqual([{ completed: true }]));
		// After the refetch it is still first, checked, with its badge, once.
		await waitFor(() =>
			expect(screen.getAllByRole("checkbox")).toHaveLength(2)
		);
		expect(screen.getByRole("checkbox", { name: CONDO_NAME })).toBeChecked();

		await user.click(await screen.findByRole("button", { name: "Desfazer" }));
		await waitFor(() =>
			expect(puts).toEqual([{ completed: true }, { completed: false }])
		);
		await waitFor(() =>
			expect(
				screen.getByRole("checkbox", { name: CONDO_NAME })
			).not.toBeChecked()
		);
		expect(screen.getByText("0 de 1 concluídos (0%)")).toBeInTheDocument();
	});

	it("shows the list instead of the empty state when only overdue habits are left", async () => {
		const { routes } = overdueRoutes([], []);
		renderApp("/today", { routes });

		expect(
			await screen.findByRole("checkbox", { name: CONDO_NAME })
		).toBeInTheDocument();
		expect(screen.queryByText("Nenhum hábito para hoje")).toBeNull();
		expect(
			screen.getByText("Nada previsto para hoje além dos atrasados.")
		).toBeInTheDocument();
	});

	it("are absent on past and future days", async () => {
		const { routes } = overdueRoutes();
		renderApp("/day/2026-10-08", { routes });
		expect(
			await screen.findByRole("checkbox", { name: "Ler" })
		).toBeInTheDocument();
		expect(screen.queryByText(/Atrasado desde/)).toBeNull();
	});

	it("are absent on a future day too", async () => {
		const { routes } = overdueRoutes();
		renderApp("/day/2026-10-10", { routes });
		// A preview day (2.14.0): the planned habits, never the overdue ones.
		expect(await screen.findByText("Ler")).toBeInTheDocument();
		expect(screen.queryByText(/Atrasado desde/)).toBeNull();
		expect(screen.queryByText(CONDO_NAME.split(",")[0]!)).toBeNull();
	});

	it("show on top of the heatmap's Hoje panel", async () => {
		const { routes } = overdueRoutes();
		renderApp("/", { routes });

		const panel = (
			await screen.findByRole("heading", { name: "Hoje" }, { timeout: 5000 })
		).closest("section");
		expect(panel).not.toBeNull();
		const boxes = await within(panel!).findAllByRole("checkbox");
		expect(boxes).toHaveLength(2);
		expect(boxes[0]).toHaveAccessibleName(CONDO_NAME);
		expect(boxes[1]).toHaveAccessibleName("Ler");
		expect(
			within(panel!).getByText("Atrasado desde 05/10")
		).toBeInTheDocument();
	});
});
