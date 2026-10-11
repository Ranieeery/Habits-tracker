// Structured logs for Workers Logs: one JSON object per line, so every field
// becomes a filter in the dashboard. Fields carry counts, statuses, codes and
// error names only: never emails, cookies, tokens, push endpoints or keys,
// request bodies or URLs with query strings.

export type LogFields = Record<string, string | number | boolean | null>;

function emit(
	level: "log" | "warn" | "error",
	event: string,
	fields: LogFields = {}
) {
	console[level]({ event, ...fields });
}

export const log = {
	info: (event: string, fields?: LogFields) => emit("log", event, fields),
	warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
	error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** An error's class name, safe to log (messages may carry data). */
export function errorName(error: unknown): string {
	return error instanceof Error ? error.name : typeof error;
}
