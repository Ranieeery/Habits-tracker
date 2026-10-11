// The security and cache headers of the static assets (public/_headers, read
// by Workers Static Assets). Guards against a rule being dropped by accident.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Rules of a `_headers` file: path → header name (lowercase) → value. */
function parseHeaders(text: string): Map<string, Map<string, string>> {
	const rules = new Map<string, Map<string, string>>();
	let current: Map<string, string> | undefined;
	for (const line of text.split("\n")) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		if (!/^\s/.test(line)) {
			current = new Map();
			rules.set(line.trim(), current);
		} else if (current) {
			const separator = line.indexOf(":");
			current.set(
				line.slice(0, separator).trim().toLowerCase(),
				line.slice(separator + 1).trim()
			);
		}
	}
	return rules;
}

const rules = parseHeaders(
	readFileSync(new URL("../public/_headers", import.meta.url), "utf8")
);

describe("public/_headers", () => {
	it("sends the security headers on every asset", () => {
		const all = rules.get("/*");
		expect(all?.get("x-content-type-options")).toBe("nosniff");
		expect(all?.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
		expect(all?.get("x-frame-options")).toBe("DENY");
		expect(all?.get("permissions-policy")).toContain("camera=()");

		const csp = all?.get("content-security-policy") ?? "";
		for (const directive of [
			"default-src 'self'",
			"script-src 'self'",
			"connect-src 'self'",
			"worker-src 'self'",
			"manifest-src 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
		]) {
			expect(csp).toContain(directive);
		}
		expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
	});

	it("never lets the shell, service worker or manifest go stale", () => {
		for (const path of [
			"/",
			"/index.html",
			"/sw.js",
			"/manifest.webmanifest",
		]) {
			expect(rules.get(path)?.get("cache-control"), path).toBe("no-cache");
		}
	});

	it("caches hashed build files for a year", () => {
		expect(rules.get("/assets/*")?.get("cache-control")).toBe(
			"public, max-age=31536000, immutable"
		);
	});

	it("stays within the Workers limits (100 rules, 2000 chars a line)", () => {
		expect(rules.size).toBeLessThanOrEqual(100);
		const text = readFileSync(
			new URL("../public/_headers", import.meta.url),
			"utf8"
		);
		for (const line of text.split("\n")) {
			expect(line.length).toBeLessThanOrEqual(2000);
		}
	});
});
