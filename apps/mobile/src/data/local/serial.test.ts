import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("createSerialQueue", () => {
	it("runs tasks one at a time, in call order", async () => {
		const run = createSerialQueue();
		const log: string[] = [];
		let running = 0;
		const task = (name: string) => async () => {
			running += 1;
			expect(running).toBe(1);
			log.push(`start ${name}`);
			await tick();
			log.push(`end ${name}`);
			running -= 1;
			return name;
		};
		const results = await Promise.all([
			run(task("a")),
			run(task("b")),
			run(task("c")),
		]);
		expect(results).toEqual(["a", "b", "c"]);
		expect(log).toEqual([
			"start a",
			"end a",
			"start b",
			"end b",
			"start c",
			"end c",
		]);
	});

	it("keeps going after a failed task", async () => {
		const run = createSerialQueue();
		const failed = run(async () => {
			throw new Error("locked");
		});
		const next = run(async () => "ok");
		await expect(failed).rejects.toThrow("locked");
		await expect(next).resolves.toBe("ok");
	});
});
