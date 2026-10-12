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
		expect(css).toContain("--color-night-accent: #8456e8;");
		expect(css).toContain("--color-night-accent-text: #bba7ff;");
		expect(css).toContain("--color-night-heat-1: #392863;");
		expect(css).toContain("--color-night-heat-5: #bba7ff;");
		// Deprecated aliases carry night values.
		expect(css).toContain("--color-accent: #8456e8;");
		expect(css).not.toContain("--color-heatmap-");
	});
});
