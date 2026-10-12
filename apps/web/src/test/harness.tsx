// Test doubles for the app's services and helpers to render the real app or
// a single component inside a router.
import { createApiClient } from "@habits/api-client";
import type {
	DayResponse,
	Habit,
	SummaryDay,
	UserSettings,
} from "@habits/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { vi } from "vitest";
import { App } from "@/App.tsx";
import type { AuthService, SessionUser } from "@/lib/auth.ts";
import { queryKeys } from "@/lib/queries.ts";
import type { PushService } from "@/lib/push.ts";
import { type Services, ServicesContext } from "@/lib/services.ts";
import { createAppRouter } from "@/router.tsx";

/** 2026-10-09 12:00 in São Paulo (UTC-3). */
export const NOW = Date.UTC(2026, 9, 9, 15, 0);
export const TODAY = "2026-10-09";
export const TIME_ZONE = "America/Sao_Paulo";

export const USER: SessionUser = {
	id: "0199c9a0-0000-7000-8000-000000000000",
	email: "dev@habits.local",
	name: "Dev",
};

export const SETTINGS: UserSettings = {
	timezone: TIME_ZONE,
	reminder_time: null,
	morning_digest_enabled: true,
	show_titles_in_notifications: true,
	created_at: 0,
	updated_at: 0,
};

export function habit(
	overrides: Partial<Habit> & Pick<Habit, "id" | "name">
): Habit {
	return {
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-01-01",
		archived_at: null,
		created_at: 0,
		updated_at: 0,
		deleted_at: null,
		...overrides,
	} as Habit;
}

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const apiError = (status: number, code: string) =>
	json({ error: { code, message: code } }, status);

type Handler = (request: Request) => Response | Promise<Response>;

/**
 * Fake API: handlers keyed by `"METHOD /v1/path"`. Unknown routes answer
 * 404, and every request is recorded.
 */
export function fakeApi(routes: Record<string, Handler>) {
	const requests: Request[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		requests.push(request.clone());
		const path = new URL(request.url).pathname.replace(/^\/api/, "");
		const handler = routes[`${request.method} ${path}`];
		return handler ? handler(request) : apiError(404, "not_found");
	};
	return { fetch: fetch as typeof globalThis.fetch, requests };
}

/** Default routes for a signed-in user with no data. */
export function defaultRoutes(
	overrides: Record<string, Handler> = {}
): Record<string, Handler> {
	return {
		"GET /v1/settings": () => json({ settings: SETTINGS }),
		"GET /v1/habits": () => json({ habits: [] }),
		"GET /v1/summary": () =>
			json({ year: 2026, days: [] satisfies SummaryDay[] }),
		"GET /v1/day": (request) =>
			json({
				date: new URL(request.url).searchParams.get("date") ?? "",
				possible_habits: [],
				completed_habit_ids: [],
			} satisfies DayResponse),
		...overrides,
	};
}

export function fakeAuth(user: SessionUser | null = USER): AuthService {
	return {
		getSession: vi.fn(async () => user),
		signIn: vi.fn(async () => {}),
		signOut: vi.fn(async () => {}),
	};
}

/** A browser without push support unless a test says otherwise. */
export function fakePush(overrides: Partial<PushService> = {}): PushService {
	let id: string | null = null;
	return {
		support: () => "unsupported",
		enable: vi.fn(async () => ({ status: "unsupported" as const })),
		current: vi.fn(async () => null),
		disable: vi.fn(async () => {}),
		deviceLabel: () => "Chrome no Windows",
		storedId: () => id,
		storeId: (value) => {
			id = value;
		},
		...overrides,
	};
}

export interface ServicesOptions {
	routes?: Record<string, Handler>;
	user?: SessionUser | null;
	auth?: AuthService;
	deviceTimeZone?: string;
	now?: number;
	push?: PushService;
	/** Ids the app generates, in order (then a counter). */
	ids?: string[];
}

export function fakeServices({
	routes = defaultRoutes(),
	user = USER,
	auth = fakeAuth(user),
	deviceTimeZone = TIME_ZONE,
	now = NOW,
	push = fakePush(),
	ids = [],
}: ServicesOptions = {}) {
	const api = fakeApi(routes);
	const pendingIds = [...ids];
	let counter = 0;
	const services: Services = {
		api: createApiClient({ baseUrl: "http://app.test/api", fetch: api.fetch }),
		auth,
		push,
		now: () => now,
		deviceTimeZone: () => deviceTimeZone,
		newId: () =>
			pendingIds.shift() ??
			`0199c9a0-ffff-7000-8000-${String(++counter).padStart(12, "0")}`,
	};
	return { services, requests: api.requests };
}

/** Renders the whole app (real router and routes) at `path`. */
export function renderApp(path: string, options: ServicesOptions = {}) {
	const { services, requests } = fakeServices(options);
	const router = createAppRouter(services, {
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	const user = userEvent.setup();
	render(<App router={router} />);
	return { router, requests, services, user };
}

/**
 * Renders one component inside a minimal router (for `<Link>`) and the
 * app's providers, with the user's settings already cached.
 */
export async function renderInRouter(
	ui: React.ReactNode,
	options: ServicesOptions = {}
) {
	const { services, requests } = fakeServices(options);
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	queryClient.setQueryData(queryKeys.settings, SETTINGS);
	const router = createRouter({
		routeTree: createRootRoute({
			component: () => <div data-testid="rendered">{ui}</div>,
		}),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(
		<ServicesContext value={services}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</ServicesContext>
	);
	await screen.findByTestId("rendered");
	return { requests, queryClient, router };
}
