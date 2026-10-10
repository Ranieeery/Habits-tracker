import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type * as React from "react";
import { ServicesContext } from "./lib/services.ts";
import type { AppRouter } from "./router.tsx";

/** Providers shared by the browser entry and the tests. */
export function App({
	router,
	children,
}: {
	router: AppRouter;
	children?: React.ReactNode;
}) {
	const { queryClient, services } = router.options.context;
	return (
		<ServicesContext value={services}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
				{children}
			</QueryClientProvider>
		</ServicesContext>
	);
}
