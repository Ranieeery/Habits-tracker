// Code-based route tree (no codegen, so `tsc` never depends on a generated
// file). Everything but /login sits under the pathless "app" route, whose
// beforeLoad sends visitors without a session to the login screen.
import { isCalendarDate } from "@habits/core";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	notFound,
	redirect,
	type RouterHistory,
} from "@tanstack/react-router";
import { z } from "zod";
import { AppLayout } from "@/components/app-layout.tsx";
import {
	NotFoundPage,
	PendingPage,
	RootLayout,
	RouteError,
} from "@/components/route-states.tsx";
import { LoginPage } from "@/features/auth/login-page.tsx";
import { DayPage, TodayPage } from "@/features/day/day-pages.tsx";
import { HabitsPage } from "@/features/habits/habits-page.tsx";
import { HeatmapPage } from "@/features/heatmap/heatmap-page.tsx";
import { SettingsPage } from "@/features/settings/settings-page.tsx";
import { queryKeys, sessionQuery, settingsQuery } from "@/lib/queries.ts";
import { createQueryClient } from "@/lib/query-client.ts";
import { safeRedirect } from "@/lib/redirect.ts";
import type { Services } from "@/lib/services.ts";

export interface RouterContext {
	queryClient: QueryClient;
	services: Services;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
	errorComponent: RouteError,
	notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: z.object({ redirect: z.string().optional() }),
	beforeLoad: async ({ context, search }) => {
		const user = await context.queryClient.ensureQueryData(
			sessionQuery(context.services.auth)
		);
		if (user) throw redirect({ href: safeRedirect(search.redirect) });
	},
	component: function LoginRoute() {
		const { redirect } = loginRoute.useSearch();
		return <LoginPage redirect={redirect} />;
	},
});

const appRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "app",
	beforeLoad: async ({ context, location }) => {
		const user = await context.queryClient.ensureQueryData(
			sessionQuery(context.services.auth)
		);
		if (!user) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { user };
	},
	// "Today" needs the user's saved time zone before any page renders.
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(settingsQuery(context.services.api)),
	component: AppLayout,
	pendingComponent: PendingPage,
	errorComponent: RouteError,
	notFoundComponent: NotFoundPage,
});

const heatmapRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/",
	component: HeatmapPage,
});

const todayRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/today",
	component: TodayPage,
});

const dayRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/day/$date",
	beforeLoad: ({ params }) => {
		if (!isCalendarDate(params.date)) throw notFound();
	},
	component: function DayRoute() {
		const { date } = dayRoute.useParams();
		return <DayPage date={date} />;
	},
});

const habitsRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/habits",
	component: HabitsPage,
});

const settingsRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/settings",
	component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
	loginRoute,
	appRoute.addChildren([
		heatmapRoute,
		todayRoute,
		dayRoute,
		habitsRoute,
		settingsRoute,
	]),
]);

export interface CreateAppRouterOptions {
	/** Memory history in tests; browser history by default. */
	history?: RouterHistory;
}

/**
 * The router and its QueryClient. A 401 from any request clears the session
 * and sends the user to the login screen, back to the same page afterwards.
 */
export function createAppRouter(
	services: Services,
	{ history }: CreateAppRouterOptions = {}
) {
	const queryClient = createQueryClient(() => {
		queryClient.setQueryData(queryKeys.session, null);
		const { pathname, href } = router.state.location;
		if (pathname === "/login") return;
		void router.navigate({
			to: "/login",
			search: { redirect: href },
			replace: true,
		});
	});

	const router = createRouter({
		routeTree,
		history,
		context: { queryClient, services },
		defaultPreload: "intent",
		// Loaders read from the QueryClient cache, which decides freshness.
		defaultPreloadStaleTime: 0,
		scrollRestoration: true,
	});
	return router;
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: AppRouter;
	}
}
