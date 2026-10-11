// CPU time per route from a `wrangler tail --format json` capture, to check
// production against the Free plan's 10 ms (README.md, "Medir o tempo de
// login"). Paths are grouped with ids and dates replaced; query strings and
// headers are never printed.
//
//   pnpm --filter api exec wrangler tail habits-api --format json > tail.json
//   (use the app, then Ctrl+C)
//   pnpm --filter api cpu-report tail.json
import { readFileSync } from "node:fs";

interface TailEvent {
	outcome?: string;
	cpuTime?: number;
	wallTime?: number;
	event?: { request?: { url?: string; method?: string }; cron?: string };
}

/** The JSON objects of a capture (one per line, or pretty-printed). */
function parseObjects(text: string): TailEvent[] {
	const objects: TailEvent[] = [];
	let depth = 0;
	let start = -1;
	let inString = false;
	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (inString) {
			if (char === "\\") i += 1;
			else if (char === '"') inString = false;
		} else if (char === '"') inString = true;
		else if (char === "{") {
			if (depth === 0) start = i;
			depth += 1;
		} else if (char === "}" && depth > 0) {
			depth -= 1;
			if (depth === 0) objects.push(JSON.parse(text.slice(start, i + 1)));
		}
	}
	return objects;
}

function routeOf(event: TailEvent): string {
	if (event.event?.cron) return `cron ${event.event.cron}`;
	const request = event.event?.request;
	if (!request?.url) return "other";
	const path = new URL(request.url).pathname
		.replace(
			/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
			":id"
		)
		.replace(/\d{4}-\d{2}-\d{2}/g, ":date");
	return `${request.method ?? "GET"} ${path}`;
}

function percentile(sorted: number[], p: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

const file = process.argv.slice(2).find((arg) => arg !== "--");
if (!file) {
	console.error("Usage: pnpm --filter api cpu-report <tail.json>");
	process.exit(1);
}

const groups = new Map<
	string,
	{ cpu: number[]; outcomes: Map<string, number> }
>();
for (const event of parseObjects(readFileSync(file, "utf8"))) {
	const route = routeOf(event);
	const group = groups.get(route) ?? {
		cpu: [] as number[],
		outcomes: new Map<string, number>(),
	};
	if (typeof event.cpuTime === "number") group.cpu.push(event.cpuTime);
	const outcome = event.outcome ?? "unknown";
	group.outcomes.set(outcome, (group.outcomes.get(outcome) ?? 0) + 1);
	groups.set(route, group);
}

const rows = [...groups]
	.map(([route, { cpu, outcomes }]) => {
		const sorted = [...cpu].sort((a, b) => a - b);
		return {
			route,
			n: cpu.length,
			p50: sorted.length ? percentile(sorted, 0.5) : null,
			p95: sorted.length ? percentile(sorted, 0.95) : null,
			max: sorted.length ? sorted[sorted.length - 1] : null,
			over10ms: cpu.filter((ms) => ms > 10).length,
			outcomes: [...outcomes].map(([o, n]) => `${o}:${n}`).join(" "),
		};
	})
	.sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0));

console.table(rows);
const exceeded = rows.filter((row) => /exceeded/i.test(row.outcomes));
if (exceeded.length > 0) {
	console.log(
		"\nSome invocations hit a limit (exceededCpu/exceededMemory = error 1102)."
	);
}
