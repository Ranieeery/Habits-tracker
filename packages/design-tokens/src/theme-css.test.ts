import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderThemeCss } from "./theme-css.ts";

describe("renderThemeCss", () => {
	it("matches the committed generated/theme.css", () => {
		const committed = readFileSync(
			new URL("./generated/theme.css", import.meta.url),
			"utf8"
		);
		expect(committed).toBe(renderThemeCss());
	});

	it("maps DEFAULT keys to the bare name and nested keys with a dash", () => {
		const css = renderThemeCss();
		expect(css).toContain("--color-accent: #8e51ff;");
		expect(css).toContain("--color-accent-hover: #c4b5fd;");
		expect(css).toContain("--color-heatmap-1: #a78bfa;");
		expect(css).toContain("--color-heatmap-1-border: #8b5cf6;");
	});
});
