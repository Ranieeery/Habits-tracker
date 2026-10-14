import { describe, expect, it } from "vitest";
import { LONG_PRESS_MS } from "./long-press.ts";

describe("the row's long press", () => {
	it("lasts one second, well beyond a short tap", () => {
		expect(LONG_PRESS_MS).toBe(1000);
	});
});
