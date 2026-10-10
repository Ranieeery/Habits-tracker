import type {
	CompletionResponse,
	HabitListResponse,
	PushSubscriptionResponse,
} from "@habits/contracts";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiClientError, createApiClient, unwrap } from "./index.ts";

const habitId = "0199c9a0-2222-7000-8000-000000000001";

/** Records the requests and answers with the given response. */
function fakeFetch(respond: () => Response) {
	const requests: Request[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		requests.push(new Request(input, init));
		return respond();
	};
	return { fetch: fetch as typeof globalThis.fetch, requests };
}

const ok = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

describe("createApiClient", () => {
	it("calls the /v1 routes with the bearer token", async () => {
		const { fetch, requests } = fakeFetch(() => ok({ habits: [] }));
		const api = createApiClient({
			baseUrl: "http://api.test",
			getToken: async () => "token-123",
			fetch,
		});

		const body = await unwrap(api.v1.habits.$get());

		expect(body).toEqual({ habits: [] });
		expect(requests[0]!.url).toBe("http://api.test/v1/habits");
		expect(requests[0]!.headers.get("authorization")).toBe("Bearer token-123");
	});

	it("sends no Authorization header without a token", async () => {
		const { fetch, requests } = fakeFetch(() => ok({ habits: [] }));
		const api = createApiClient({ baseUrl: "http://api.test", fetch });

		await unwrap(api.v1.habits.$get());

		expect(requests[0]!.headers.get("authorization")).toBeNull();
	});

	it("builds path params and JSON bodies", async () => {
		const { fetch, requests } = fakeFetch(() => ok({ completion: {} }));
		const api = createApiClient({ baseUrl: "http://api.test", fetch });

		await api.v1.habits[":habit_id"].completions[":date"].$put({
			param: { habit_id: habitId, date: "2026-10-09" },
			json: { completed: true },
		});

		const [request] = requests;
		expect(request!.method).toBe("PUT");
		expect(request!.url).toBe(
			`http://api.test/v1/habits/${habitId}/completions/2026-10-09`
		);
		expect(await request!.json()).toEqual({ completed: true });
	});
});

describe("unwrap", () => {
	it("throws ApiClientError with the ApiError code", async () => {
		const { fetch } = fakeFetch(() =>
			ok(
				{
					error: {
						code: "date_out_of_range",
						message: "Date is outside the editable window",
						details: { from: "2026-10-02", to: "2026-10-10" },
					},
				},
				422
			)
		);
		const api = createApiClient({ baseUrl: "http://api.test", fetch });

		const error = await unwrap(
			api.v1.habits[":habit_id"].completions[":date"].$put({
				param: { habit_id: habitId, date: "2026-09-01" },
				json: { completed: true },
			})
		).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiClientError);
		expect(error).toMatchObject({
			status: 422,
			code: "date_out_of_range",
			details: { from: "2026-10-02", to: "2026-10-10" },
		});
	});

	it("reports bodies that are not an ApiError as unknown", async () => {
		const { fetch } = fakeFetch(() => new Response("oops", { status: 502 }));
		const api = createApiClient({ baseUrl: "http://api.test", fetch });

		await expect(unwrap(api.v1.habits.$get())).rejects.toMatchObject({
			status: 502,
			code: "unknown",
		});
	});

	it("returns undefined for 204", async () => {
		const { fetch } = fakeFetch(() => new Response(null, { status: 204 }));
		const api = createApiClient({ baseUrl: "http://api.test", fetch });

		const result = await unwrap(
			api.v1.push.subscriptions[":subscription_id"].$delete({
				param: { subscription_id: habitId },
			})
		);
		expect(result).toBeUndefined();
	});

	it("infers the success bodies from the API routes", () => {
		// Type-level only: the functions are never called.
		const api = createApiClient({ baseUrl: "http://api.test" });
		const list = () => unwrap(api.v1.habits.$get());
		const complete = () =>
			unwrap(
				api.v1.habits[":habit_id"].completions[":date"].$put({
					param: { habit_id: habitId, date: "2026-10-09" },
					json: { completed: true },
				})
			);
		const register = () =>
			unwrap(
				api.v1.push.subscriptions.$post({
					json: { kind: "expo", token: "ExponentPushToken[x]" },
				})
			);

		expectTypeOf(list).returns.resolves.toEqualTypeOf<HabitListResponse>();
		expectTypeOf(complete).returns.resolves.toEqualTypeOf<CompletionResponse>();
		expectTypeOf(
			register
		).returns.resolves.toEqualTypeOf<PushSubscriptionResponse>();
	});
});
