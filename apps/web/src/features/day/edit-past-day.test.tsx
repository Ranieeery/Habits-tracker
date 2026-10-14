// Editing past days (2.3.0): read-only until "Editar este dia" is confirmed,
// unlocked only for this visit, and "Desfazer" after every change.
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	apiError,
	defaultRoutes,
	habit,
	json,
	renderApp,
	TODAY,
} from "@/test/harness.tsx";

const water = habit({
	id: "0199c9a0-1111-7000-8000-000000000001",
	name: "Beber água",
});
const read = habit({ id: "0199c9a0-1111-7000-8000-000000000002", name: "Ler" });

const PAST = "2026-10-01"; // 8 days before TODAY
const LIMIT = "2026-09-09"; // exactly 30 days before
const TOO_OLD = "2026-09-08"; // 31 days before
const TOMORROW = "2026-10-10";
const DATES = [TODAY, PAST, "2026-10-02", LIMIT, TOO_OLD, TOMORROW];

/**
 * A server with both habits every day; completions per date live in
 * `done`. `fail` makes every PUT answer with that response instead.
 */
function server(options: { fail?: () => Response; emptyOn?: string } = {}) {
	const done = new Map<string, Set<string>>();
	const of = (date: string) => done.get(date) ?? new Set<string>();
	const puts: Record<string, (request: Request) => Promise<Response>> = {};
	for (const date of DATES) {
		for (const { id } of [water, read]) {
			puts[`PUT /v1/habits/${id}/completions/${date}`] = async (request) => {
				if (options.fail) return options.fail();
				const { completed } = (await request.json()) as {
					completed: boolean;
				};
				const set = new Set(of(date));
				if (completed) set.add(id);
				else set.delete(id);
				done.set(date, set);
				return json({ completion: {} });
			};
		}
	}
	const routes = defaultRoutes({
		// Preview days (2.14.0) are built from the habits.
		"GET /v1/habits": () => json({ habits: [water, read] }),
		"GET /v1/day": (request) => {
			const date = new URL(request.url).searchParams.get("date") ?? "";
			return json({
				date,
				possible_habits: date === options.emptyOn ? [] : [water, read],
				completed_habit_ids: [...of(date)],
			});
		},
		...puts,
	});
	return { routes, done: of };
}

const editButton = () =>
	screen.queryByRole("button", { name: "Editar este dia" });

async function confirmEdit(user: ReturnType<typeof renderApp>["user"]) {
	await user.click(
		await screen.findByRole("button", { name: "Editar este dia" })
	);
	const dialog = await screen.findByRole("alertdialog");
	await user.click(within(dialog).getByRole("button", { name: "Editar" }));
	await screen.findByText("Editando dia passado");
}

describe("the edit button", () => {
	it.each([
		["a past day in the window", PAST],
		["exactly 30 days ago", LIMIT],
	])("shows on %s", async (_, date) => {
		renderApp(`/day/${date}`, { routes: server().routes });
		expect(
			await screen.findByRole("button", { name: "Editar este dia" })
		).toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();
	});

	it("is not on today", async () => {
		renderApp("/today", { routes: server().routes });
		const checkbox = await screen.findByRole("checkbox", {
			name: "Beber água",
		});
		expect(checkbox).toBeEnabled();
		expect(editButton()).not.toBeInTheDocument();
		expect(screen.queryByText(/Somente leitura/)).not.toBeInTheDocument();
	});

	it("is not on a future day", async () => {
		renderApp(`/day/${TOMORROW}`, { routes: server().routes });
		// A preview day (2.14.0): read only, without checkboxes.
		await screen.findByText("Dia futuro, somente leitura");
		expect(await screen.findByText("Beber água")).toBeInTheDocument();
		expect(editButton()).not.toBeInTheDocument();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("is not on a day older than the window, which says why", async () => {
		renderApp(`/day/${TOO_OLD}`, { routes: server().routes });
		await screen.findByText("Fora do período de edição de 30 dias");
		expect(editButton()).not.toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();
	});

	it("is not on a past day without habits", async () => {
		renderApp(`/day/${PAST}`, { routes: server({ emptyOn: PAST }).routes });
		await screen.findByText("Nenhum hábito para este dia");
		expect(editButton()).not.toBeInTheDocument();
	});
});

describe("unlocking a past day", () => {
	it("asks first: Cancelar has the focus and keeps the day locked", async () => {
		const { user, requests } = renderApp(`/day/${PAST}`, {
			routes: server().routes,
		});
		await user.click(
			await screen.findByRole("button", { name: "Editar este dia" })
		);

		const dialog = await screen.findByRole("alertdialog", {
			name: "Editar o dia 01/10?",
		});
		expect(dialog).toHaveTextContent(
			"Este dia já passou. Ao alterar, o mapa de hábitos e as sequências serão recalculados."
		);
		const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
		expect(cancel).toHaveFocus();

		await user.click(cancel);
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
		);
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();
		expect(screen.queryByText("Editando dia passado")).not.toBeInTheDocument();
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
	});

	it("closes on Esc without unlocking", async () => {
		const { user } = renderApp(`/day/${PAST}`, { routes: server().routes });
		await user.click(
			await screen.findByRole("button", { name: "Editar este dia" })
		);
		await screen.findByRole("alertdialog");

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
		);
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();
	});

	it("unlocks after Editar: notice, working checkboxes, Concluir edição", async () => {
		const { routes, done } = server();
		const { user } = renderApp(`/day/${PAST}`, { routes });
		await confirmEdit(user);

		const notice = screen.getByRole("status");
		expect(notice).toHaveTextContent("Editando dia passado");
		const finish = within(notice).getByRole("button", {
			name: "Concluir edição",
		});
		expect(finish).toHaveFocus();

		// No confirmation per checkbox.
		await user.click(screen.getByRole("checkbox", { name: "Beber água" }));
		await user.click(screen.getByRole("checkbox", { name: "Ler" }));
		await waitFor(() =>
			expect(done(PAST)).toEqual(new Set([water.id, read.id]))
		);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

		await user.click(finish);
		expect(screen.queryByText("Editando dia passado")).not.toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Editar este dia" })
		).toHaveFocus();
	});

	it("locks again on another day and after leaving the screen", async () => {
		const { user, router } = renderApp(`/day/${PAST}`, {
			routes: server().routes,
		});
		await confirmEdit(user);

		await act(() =>
			router.navigate({ to: "/day/$date", params: { date: "2026-10-02" } })
		);
		expect(
			await screen.findByRole("button", { name: "Editar este dia" })
		).toBeInTheDocument();
		expect(screen.queryByText("Editando dia passado")).not.toBeInTheDocument();

		await act(() =>
			router.navigate({ to: "/day/$date", params: { date: PAST } })
		);
		expect(
			await screen.findByRole("button", { name: "Editar este dia" })
		).toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "Beber água" })).toBeDisabled();

		await confirmEdit(user);
		await act(() => router.navigate({ to: "/habits" }));
		await act(() =>
			router.navigate({ to: "/day/$date", params: { date: PAST } })
		);
		expect(
			await screen.findByRole("button", { name: "Editar este dia" })
		).toBeInTheDocument();
		expect(screen.queryByText("Editando dia passado")).not.toBeInTheDocument();
	});
});

describe("Desfazer", () => {
	it("undoes the last change on today", async () => {
		const { routes, done } = server();
		const { user, requests } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("checkbox", { name: "Beber água" })
		);

		expect(await screen.findByText("Marcado: Beber água")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Desfazer" }));

		await screen.findByText("Alteração desfeita");
		await waitFor(() => expect(done(TODAY).size).toBe(0));
		const bodies = await Promise.all(
			requests.filter((r) => r.method === "PUT").map((r) => r.json())
		);
		expect(bodies).toEqual([{ completed: true }, { completed: false }]);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Desfazer" })
			).not.toBeInTheDocument()
		);
		await waitFor(() =>
			expect(
				screen.getByRole("checkbox", { name: "Beber água" })
			).not.toBeChecked()
		);
	});

	it("a new change replaces the message: only the last one is undone", async () => {
		const { routes, done } = server();
		const { user } = renderApp("/today", { routes });
		await user.click(
			await screen.findByRole("checkbox", { name: "Beber água" })
		);
		await screen.findByText("Marcado: Beber água");
		await user.click(screen.getByRole("checkbox", { name: "Ler" }));
		await screen.findByText("Marcado: Ler");

		await waitFor(() =>
			expect(screen.queryByText("Marcado: Beber água")).not.toBeInTheDocument()
		);
		const undo = screen.getAllByRole("button", { name: "Desfazer" });
		expect(undo).toHaveLength(1);
		await user.click(undo[0]!);

		await waitFor(() => expect(done(TODAY)).toEqual(new Set([water.id])));
	});

	it("works on an unlocked past day", async () => {
		const { routes, done } = server();
		const { user } = renderApp(`/day/${PAST}`, { routes });
		await confirmEdit(user);
		await user.click(screen.getByRole("checkbox", { name: "Ler" }));
		await screen.findByText("Marcado: Ler");
		await waitFor(() => expect(done(PAST)).toEqual(new Set([read.id])));

		await user.click(screen.getByRole("button", { name: "Desfazer" }));
		await waitFor(() => expect(done(PAST).size).toBe(0));
	});

	it("goes away when the day is locked again", async () => {
		const { user } = renderApp(`/day/${PAST}`, { routes: server().routes });
		await confirmEdit(user);
		await user.click(screen.getByRole("checkbox", { name: "Ler" }));
		await screen.findByText("Marcado: Ler");

		await user.click(screen.getByRole("button", { name: "Concluir edição" }));
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Desfazer" })
			).not.toBeInTheDocument()
		);
	});

	it("rolls back a refused change of a past day, without Desfazer", async () => {
		const { user } = renderApp(`/day/${PAST}`, {
			routes: server({ fail: () => apiError(422, "date_out_of_range") }).routes,
		});
		await confirmEdit(user);
		const checkbox = screen.getByRole("checkbox", { name: "Beber água" });
		await user.click(checkbox);

		expect(
			await screen.findByText("Não foi possível salvar")
		).toBeInTheDocument();
		expect(
			screen.getByText("Essa data não pode mais ser alterada.")
		).toBeInTheDocument();
		await waitFor(() => expect(checkbox).not.toBeChecked());
		expect(
			screen.queryByRole("button", { name: "Desfazer" })
		).not.toBeInTheDocument();
	});
});
