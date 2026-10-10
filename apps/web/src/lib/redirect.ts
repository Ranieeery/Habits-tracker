/**
 * Only same-app paths are followed after login (no `//host` or absolute
 * URLs), so a crafted link cannot send the user elsewhere.
 */
export function safeRedirect(target: string | undefined): string {
	if (!target?.startsWith("/") || /^\/[/\\]/.test(target)) return "/";
	if (target.startsWith("/login")) return "/";
	return target;
}
