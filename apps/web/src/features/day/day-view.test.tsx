import { screen, waitFor } from "@testing-library/react";
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

/** A promise the test resolves by hand, to look at the optimistic state. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

function dayRoutes(
	completed: () => string[],
	put: () => Promise<Response> | Response
) {
	return defaultRoutes({
		"GET /v1/day": (request) =>
			json({
				date: new URL(request.url).searchParams.get("date"),
				possible_habits: [water, read],
				completed_habit_ids: completed(),
			}),
		[`PUT /v1/habits/${water.id}/completions/${TODAY}`]: put,
	});
}

describe("day view toggle", () => {
	it("checks at once and rolls back with a message when saving fails", async () => {
		const response = deferred<Response>();
		const { user, requests } = renderApp("/today", {
			routes: dayRoutes(
				() => [],
				() => response.promise
			),
		});

		const checkbox = await screen.findByRole("checkbox", {
			name: "Beber água",
		});
		expect(checkbox).not.toBeChecked();
		expect(screen.getByText("0 de 2 concluídos (0%)")).toBeInTheDocument();

		await user.click(checkbox);

		// Optimistic: checked before the server answers.
		expect(checkbox).toBeChecked();
		expect(screen.getByText("1 de 2 concluídos (50%)")).toBeInTheDocument();

		response.resolve(apiError(500, "internal_error"));

		await waitFor(() => expect(checkbox).not.toBeChecked());
		expect(
			await screen.findByText("Não foi possível salvar")
		).toBeInTheDocument();
		const put = requests.find((r) => r.method === "PUT");
		expect(await put?.json()).toEqual({ completed: true });
	});

	it("keeps the change when the server accepts it", async () => {
		let completed: string[] = [];
		const { user } = renderApp("/today", {
			routes: dayRoutes(
				() => completed,
				() => {
					completed = [water.id];
					return json({ completion: {} });
				}
			),
		});

		const checkbox = await screen.findByRole("checkbox", {
			name: "Beber água",
		});
		await user.click(checkbox);
		expect(checkbox).toBeChecked();
		// After the refetch the server state agrees.
		await waitFor(() => expect(completed).toEqual([water.id]));
		await waitFor(() =>
			expect(screen.getByText("1 de 2 concluídos (50%)")).toBeInTheDocument()
		);
		expect(
			screen.queryByText("Não foi possível salvar")
		).not.toBeInTheDocument();
		expect(checkbox).toBeChecked();
	});

	it("shows past days read-only", async () => {
		renderApp("/day/2026-10-01", {
			routes: dayRoutes(
				() => [read.id],
				() => json({})
			),
		});

		const checkbox = await screen.findByRole("checkbox", {
			name: "Beber água",
		});
		expect(checkbox).toBeDisabled();
		expect(screen.getByRole("checkbox", { name: "Ler" })).toBeChecked();
		expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
	});

	it("shows an empty state when nothing is scheduled on a past day", async () => {
		renderApp("/day/2026-10-01");
		expect(
			await screen.findByText("Nenhum hábito para este dia")
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Novo hábito" })
		).not.toBeInTheDocument();
	});
});
