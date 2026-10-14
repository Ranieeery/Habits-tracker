// "Adiar" (2.16.0): postponing one occurrence of a single-date or
// days-of-month habit from the actions menu of today and the preview days.
// TODAY = Friday 2026-10-09.
import {
	CreateRescheduleRequest,
	type DayResponse,
	type Habit,
	type HabitReschedule,
} from "@habits/contracts";
import {
	checkReschedule,
	dayView,
	rescheduleError,
	rescheduleIndex,
	todayView,
} from "@habits/core";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	defaultRoutes,
	habit,
	json,
	NOW,
	renderApp,
	TIME_ZONE,
	TODAY,
} from "@/test/harness.tsx";

const conta = habit({
	id: "0199c9a0-2222-7000-8000-000000000001",
	name: "Pagar conta",
	schedule: { type: "monthly_days", days: [9] },
	start_date: "2026-09-01",
});
const consulta = habit({
	id: "0199c9a0-2222-7000-8000-000000000002",
	name: "Consulta",
	schedule: { type: "once", date: "2026-10-12" },
	start_date: "2026-10-01",
});
const ler = habit({
	id: "0199c9a0-2222-7000-8000-000000000003",
	name: "Ler",
});
// A single date on 05/10 postponed to today (the badge, the limit).
const exame = habit({
	id: "0199c9a0-2222-7000-8000-000000000005",
	name: "Exame",
	schedule: { type: "once", date: "2026-10-05" },
	start_date: "2026-10-01",
});
// Missed on 05/10: overdue today.
const condominio = habit({
	id: "0199c9a0-2222-7000-8000-000000000004",
	name: "Condomínio",
	schedule: { type: "monthly_days", days: [5] },
	start_date: "2026-09-01",
});

const row = (
	habitId: string,
	original: string,
	to: string,
	sequence = 1,
	from = original
): HabitReschedule => ({
	id: `0199c9a0-3333-7000-8000-00000000000${sequence}`,
	habit_id: habitId,
	original_date: original,
	from_date: from,
	to_date: to,
	sequence,
	created_at: NOW,
	updated_at: NOW,
	deleted_at: null,
});

/**
 * A small API: days and today come from core with the postponements kept
 * here, and creating one runs core's `checkReschedule` like the server.
 */
function server({
	rows: initial = [] as HabitReschedule[],
	failPost = false,
	habits = [conta, consulta, ler, condominio] as Habit[],
} = {}) {
	let rows = [...initial];
	const posts: CreateRescheduleRequest[] = [];
	const options = () => ({
		timeZone: TIME_ZONE,
		reschedules: rescheduleIndex(rows, []),
	});
	const routes = defaultRoutes({
		"GET /v1/habits": () => json({ habits }),
		"GET /v1/reschedules": () =>
			json({
				reschedules: rows.filter((r) => r.deleted_at === null),
				completions: [],
			}),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? TODAY;
			const view = date === TODAY ? todayView : dayView;
			return json(view(habits, [], date, options()) satisfies DayResponse);
		},
	});
	const addUndo = (created: HabitReschedule) => {
		routes[`DELETE /v1/habits/${created.habit_id}/reschedules/${created.id}`] =
			() => {
				rows = rows.map((r) =>
					r.id === created.id ? { ...r, deleted_at: NOW } : r
				);
				return json({ reschedule: rows.find((r) => r.id === created.id) });
			};
	};
	for (const item of habits) {
		routes[`POST /v1/habits/${item.id}/reschedules`] = async (request) => {
			const body = CreateRescheduleRequest.parse(await request.json());
			posts.push(body);
			if (failPost) {
				return json(
					{
						error: {
							code: "date_out_of_range",
							message: "too far",
							details: { reason: "too_far", latest: "2027-01-07" },
						},
					},
					422
				);
			}
			const problem = checkReschedule({
				habit: item,
				rows,
				completedDates: [],
				request: body,
				today: TODAY,
			});
			if (problem) {
				return json({ error: rescheduleError(problem) }, 409);
			}
			const created: HabitReschedule = {
				...body,
				habit_id: item.id,
				created_at: NOW,
				updated_at: NOW,
				deleted_at: null,
			};
			rows.push(created);
			addUndo(created);
			return json({ reschedule: created }, 201);
		};
	}
	for (const r of initial) addUndo(r);
	return { routes, posts, rows: () => rows };
}

async function openMenu(
	user: ReturnType<typeof renderApp>["user"],
	name: string
) {
	await user.click(
		await screen.findByRole("button", { name: `Mais opções de ${name}` })
	);
	return screen.findByRole("menu");
}

const labels = (menu: HTMLElement) =>
	within(menu)
		.getAllByRole("menuitem")
		.map((item) => item.textContent);

describe("'Adiar' in the menu", () => {
	it("on today's single-date and days-of-month rows, between edit and the description", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		const menu = await openMenu(user, "Pagar conta");
		expect(labels(menu)[1]).toBe("AdiarSó esta ocorrência");
		expect(labels(menu)).toEqual([
			"Editar hábitoVale para todos os dias",
			"AdiarSó esta ocorrência",
			"Arquivar",
		]);
	});

	it("not on weekday habits nor on an overdue row", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		expect(labels(await openMenu(user, "Ler"))).not.toContain(
			"AdiarSó esta ocorrência"
		);
		await user.keyboard("{Escape}");
		expect(labels(await openMenu(user, "Condomínio"))).not.toContain(
			"AdiarSó esta ocorrência"
		);
	});

	it("disabled with the reason when the occurrence was postponed twice", async () => {
		const { routes } = server({
			habits: [exame],
			rows: [
				row(exame.id, "2026-10-05", "2026-10-07"),
				row(exame.id, "2026-10-05", TODAY, 2, "2026-10-07"),
			],
		});
		const { user } = renderApp("/today", { routes });
		// The occurrence of 05/10 lives today, postponed twice.
		expect(
			await screen.findByRole("checkbox", {
				name: "Exame, adiado de 5 de outubro",
			})
		).toBeInTheDocument();
		const menu = await openMenu(user, "Exame");
		const item = within(menu).getByRole("menuitem", { name: /Adiar/ });
		expect(item).toHaveAttribute("aria-disabled", "true");
		expect(item).toHaveTextContent("Limite de 2 adiamentos atingido");
		await user.click(item);
		// Nothing opens; the menu stays.
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("on a preview day where the occurrence lives, not on a past day", async () => {
		const { routes } = server();
		const { user } = renderApp("/day/2026-10-12", { routes });
		const menu = await openMenu(user, "Consulta");
		expect(labels(menu)).toEqual([
			"Editar hábitoVale para todos os dias",
			"AdiarSó esta ocorrência",
		]);
		await user.keyboard("{Escape}");

		const past = server();
		renderApp("/day/2026-10-05", { routes: past.routes });
		await screen.findAllByText("Condomínio", undefined, { timeout: 5000 });
		expect(
			screen.queryByRole("button", { name: "Mais opções de Condomínio" })
		).toBeNull();
	});
});

describe("the dialog", () => {
	it("offers valid quick choices, summarizes the effect and postpones", async () => {
		const { routes, posts } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			within(await openMenu(user, "Pagar conta")).getByRole("menuitem", {
				name: /Adiar/,
			})
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Adiar Pagar conta",
		});
		const tomorrow = within(dialog).getByRole("button", { name: /Amanhã/ });
		expect(tomorrow).toHaveAttribute("aria-pressed", "true");
		expect(tomorrow).toHaveFocus();
		expect(dialog).toHaveTextContent(
			"O dia 09/10 deixa de contar este hábito (sem falha). Passa para 10/10."
		);
		expect(dialog).toHaveTextContent("Resta 1 adiamento.");
		await user.click(
			within(dialog).getByRole("button", { name: /Daqui a 1 semana/ })
		);
		expect(dialog).toHaveTextContent("Passa para 16/10.");
		await user.click(within(dialog).getByRole("button", { name: "Adiar" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(posts).toEqual([
			expect.objectContaining({
				original_date: TODAY,
				from_date: TODAY,
				to_date: "2026-10-16",
				sequence: 1,
			}),
		]);
		expect(await screen.findByText("Adiado para 16/10")).toBeInTheDocument();
		// It left today's list; a note says where it went.
		await waitFor(() =>
			expect(screen.queryByRole("checkbox", { name: /Pagar conta/ })).toBeNull()
		);
		expect(
			screen.getByRole("list", { name: "Adiados deste dia" })
		).toHaveTextContent("Pagar conta · Adiado para 16/10");
	});

	it("disables a quick choice past the next occurrence, with the reason", async () => {
		const twice = habit({
			id: "0199c9a0-2222-7000-8000-000000000009",
			name: "Remédio",
			schedule: { type: "monthly_days", days: [9, 12] },
			start_date: "2026-09-01",
		});
		const { routes } = server({ habits: [twice] });
		const { user } = renderApp("/today", { routes });
		await user.click(
			within(await openMenu(user, "Remédio")).getByRole("menuitem", {
				name: /Adiar/,
			})
		);
		const dialog = await screen.findByRole("dialog");
		const week = within(dialog).getByRole("button", {
			name: /Daqui a 1 semana/,
		});
		expect(week).toHaveAttribute("aria-disabled", "true");
		expect(week).toHaveTextContent("Passa da próxima ocorrência (12/10)");
		await user.click(week);
		expect(week).toHaveAttribute("aria-pressed", "false");
	});

	it("keeps the choice when saving fails", async () => {
		const { routes } = server({ failPost: true });
		const { user } = renderApp("/today", { routes });
		await user.click(
			within(await openMenu(user, "Pagar conta")).getByRole("menuitem", {
				name: /Adiar/,
			})
		);
		const dialog = await screen.findByRole("dialog");
		await user.click(
			within(dialog).getByRole("button", { name: /Daqui a 1 semana/ })
		);
		await user.click(within(dialog).getByRole("button", { name: "Adiar" }));
		expect(
			await within(dialog).findByText(
				"A data nova pode ir no máximo até 07/01/2027."
			)
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: /Daqui a 1 semana/ })
		).toHaveAttribute("aria-pressed", "true");
		// The habit is back on today (behind the dialog, hidden while open).
		await user.keyboard("{Escape}");
		expect(
			await screen.findByRole("checkbox", { name: "Pagar conta" })
		).toBeInTheDocument();
	});

	it("undo removes the postponement", async () => {
		const { routes, rows } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			within(await openMenu(user, "Pagar conta")).getByRole("menuitem", {
				name: /Adiar/,
			})
		);
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", {
				name: "Adiar",
			})
		);
		const toast = (await screen.findByText("Adiado para 10/10")).closest("li");
		if (!toast) throw new Error("no toast");
		await user.click(within(toast).getByRole("button", { name: "Desfazer" }));
		await waitFor(() => expect(rows()[0]?.deleted_at).toBe(NOW));
		expect(
			await screen.findByRole("checkbox", { name: "Pagar conta" })
		).toBeInTheDocument();
	});
});

describe("the badge", () => {
	it("says 'Adiado de' on the new day (also read by screen readers)", async () => {
		const { routes } = server({
			habits: [exame],
			rows: [row(exame.id, "2026-10-05", TODAY)],
		});
		renderApp("/today", { routes });
		expect(
			await screen.findByRole("checkbox", {
				name: "Exame, adiado de 5 de outubro",
			})
		).toBeInTheDocument();
		expect(screen.getByText("Adiado de 05/10")).toBeInTheDocument();
	});

	it("shows on a preview day too", async () => {
		const { routes } = server({
			habits: [consulta],
			rows: [row(consulta.id, "2026-10-12", "2026-10-14")],
		});
		renderApp("/day/2026-10-14", { routes });
		expect(await screen.findByText("Adiado de 12/10")).toBeInTheDocument();
	});

	it("keeps its animation under motion-safe only", async () => {
		const { routes } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			within(await openMenu(user, "Pagar conta")).getByRole("menuitem", {
				name: /Adiar/,
			})
		);
		const dialog = await screen.findByRole("dialog");
		for (const element of dialog.querySelectorAll("button[aria-pressed]")) {
			const classes = element.getAttribute("class") ?? "";
			for (const name of classes.split(/\s+/)) {
				if (/^(transition|duration|animate)/.test(name)) {
					throw new Error(`motion outside motion-safe: ${name}`);
				}
			}
		}
	});
});
