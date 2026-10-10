// Path mapping of the public gateway: the web app calls the API under
// `/api`, while the API Worker's routes start at `/v1`.

const API_PREFIX = "/api";

/**
 * The request to forward to the API Worker, with the `/api` prefix removed
 * (method, headers such as the session cookie and `cf-connecting-ip`, body
 * and host are kept), or null when the path is not an API path.
 */
export function toApiRequest(request: Request): Request | null {
	const url = new URL(request.url);
	const { pathname } = url;
	if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) {
		return null;
	}
	url.pathname = pathname.slice(API_PREFIX.length) || "/";
	return new Request(url, request);
}
