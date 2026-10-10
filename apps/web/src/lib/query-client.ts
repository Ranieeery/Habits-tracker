import { ApiClientError } from "@habits/api-client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

export function isUnauthorized(error: unknown): boolean {
	return error instanceof ApiClientError && error.status === 401;
}

/**
 * A 401 from any query or mutation means the session expired:
 * `onUnauthorized` sends the user to the login screen.
 */
export function createQueryClient(onUnauthorized: () => void): QueryClient {
	const handle = (error: unknown) => {
		if (isUnauthorized(error)) onUnauthorized();
	};
	return new QueryClient({
		queryCache: new QueryCache({ onError: handle }),
		mutationCache: new MutationCache({ onError: handle }),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				retry: (failureCount, error) =>
					!(error instanceof ApiClientError && error.status < 500) &&
					failureCount < 2,
			},
		},
	});
}
