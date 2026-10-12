import { describe, expect, it } from "vitest";
import {
	compareHabitOrder,
	initialSortKeys,
	isValidSortKey,
	keyAfterLast,
	keyBetween,
	moveHabit,
	sortHabits,
	withSortKeys,
} from "./sort-key.ts";

/** A small deterministic generator (tests only). */
function random(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) % 2 ** 31;
		return state / 2 ** 31;
	};
}

const habit = (id: string, sort_key: string, created_at = 0) => ({
	id,
	sort_key,
	created_at,
});

describe("keyBetween", () => {
	it("starts at a0 and appends a0, a1 … az, b00", () => {
		const keys = initialSortKeys(64);
		expect(keys.slice(0, 3)).toEqual(["a0", "a1", "a2"]);
		expect(keys[61]).toBe("az");
		expect(keys[62]).toBe("b00");
		expect(keys[63]).toBe("b01");
	});

	it("puts a key between two keys and around the ends", () => {
		expect(keyBetween("a0", "a2")).toBe("a1");
		const mid = keyBetween("a0", "a1");
		expect("a0" < mid && mid < "a1").toBe(true);
		const before = keyBetween(null, "a0");
		expect(before < "a0").toBe(true);
		expect(keyBetween("az", null)).toBe("b00");
	});

	it("rejects keys out of order and malformed keys", () => {
		expect(() => keyBetween("a1", "a1")).toThrow(RangeError);
		expect(() => keyBetween("a2", "a1")).toThrow(RangeError);
		expect(() => keyBetween("a10", null)).toThrow(RangeError); // trailing zero
		expect(() => keyBetween("!", null)).toThrow(RangeError);
		expect(isValidSortKey("")).toBe(false);
		expect(isValidSortKey("a0")).toBe(true);
	});

	it("keeps any sequence of random inserts in order", () => {
		const next = random(42);
		const keys: string[] = [];
		for (let i = 0; i < 2000; i++) {
			const at = Math.floor(next() * (keys.length + 1));
			const key = keyBetween(keys[at - 1] ?? null, keys[at] ?? null);
			expect(isValidSortKey(key)).toBe(true);
			keys.splice(at, 0, key);
		}
		expect([...keys].sort()).toEqual(keys);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("stays short when appending or prepending many times", () => {
		let last: string | null = null;
		let first: string | null = null;
		for (let i = 0; i < 1000; i++) {
			last = keyBetween(last, null);
			first = keyBetween(null, first);
		}
		expect(last!.length).toBeLessThanOrEqual(3);
		expect(first!.length).toBeLessThanOrEqual(3);
	});

	it("stays within 64 characters when always inserting in the same gap", () => {
		let low = "a0";
		const high = "a1";
		for (let i = 0; i < 300; i++) low = keyBetween(low, high);
		expect(low.length).toBeLessThanOrEqual(64);
	});
});

describe("habit order", () => {
	it("sorts by key, empty keys last, then by creation and id", () => {
		const list = [
			habit("c", "", 1),
			habit("b", "a1"),
			habit("a", "a1"),
			habit("d", "a0"),
			habit("e", "", 0),
		];
		expect(sortHabits(list).map((h) => h.id)).toEqual([
			"d",
			"a",
			"b",
			"e",
			"c",
		]);
		expect(compareHabitOrder(habit("x", "a0"), habit("y", "a0"))).toBeLessThan(
			0
		);
	});

	it("keyAfterLast skips deleted habits and invalid keys", () => {
		expect(keyAfterLast([])).toBe("a0");
		expect(
			keyAfterLast([
				{ sort_key: "a3", deleted_at: null },
				{ sort_key: "a9", deleted_at: 5 },
				{ sort_key: "", deleted_at: null },
			])
		).toBe("a4");
	});
});

describe("moveHabit", () => {
	const list = [
		habit("a", "a0"),
		habit("b", "a1"),
		habit("c", "a2"),
		habit("d", "a3"),
	];
	const order = (changes: ReturnType<typeof moveHabit>) =>
		withSortKeys(list, changes).map((h) => h.id);

	it("changes only the moved habit, to the start, the middle or the end", () => {
		const toStart = moveHabit(list, "c", 0);
		expect(toStart).toHaveLength(1);
		expect(order(toStart)).toEqual(["c", "a", "b", "d"]);

		const down = moveHabit(list, "a", 2);
		expect(down).toHaveLength(1);
		expect(order(down)).toEqual(["b", "c", "a", "d"]);

		expect(order(moveHabit(list, "b", 3))).toEqual(["a", "c", "d", "b"]);
		expect(order(moveHabit(list, "d", 99))).toEqual(["a", "b", "c", "d"]);
	});

	it("does nothing for no move or an unknown habit", () => {
		expect(moveHabit(list, "b", 1)).toEqual([]);
		expect(moveHabit(list, "zz", 0)).toEqual([]);
	});

	it("renumbers the list when the neighbors leave no room", () => {
		const legacy = [habit("a", ""), habit("b", ""), habit("c", "")];
		const changes = moveHabit(legacy, "c", 0);
		expect(changes.map((c) => c.habit_id).sort()).toEqual(["a", "b", "c"]);
		expect(withSortKeys(legacy, changes).map((h) => h.id)).toEqual([
			"c",
			"a",
			"b",
		]);

		const tie = [habit("a", "a1"), habit("b", "a1"), habit("c", "a2")];
		expect(withSortKeys(tie, moveHabit(tie, "c", 1)).map((h) => h.id)).toEqual([
			"a",
			"c",
			"b",
		]);
	});
});

describe("moveHabit at scale", () => {
	it("always writes a single key in a list of 500, and keys stay within 64 characters", () => {
		const next = random(7);
		const list = initialSortKeys(500).map((key, i) => habit(`h${i}`, key, i));
		let longest = 0;
		let moves = 0;
		const wrong: number[] = [];
		for (let i = 0; i < 10_000; i++) {
			const from = Math.floor(next() * list.length);
			const to = Math.floor(next() * list.length);
			const changes = moveHabit(list, list[from]!.id, to);
			if (from === to) {
				if (changes.length !== 0) wrong.push(i);
				continue;
			}
			if (changes.length !== 1) {
				wrong.push(i);
				continue;
			}
			moves++;
			longest = Math.max(longest, changes[0]!.sort_key.length);
			// Move it in place (linear) instead of re-sorting the whole list.
			const [moved] = list.splice(from, 1);
			list.splice(to, 0, { ...moved!, sort_key: changes[0]!.sort_key });
		}
		expect(wrong).toEqual([]);
		expect(moves).toBeGreaterThan(9000);
		expect(longest).toBeLessThanOrEqual(64);
		// The keys alone give back the order built move by move.
		expect(sortHabits(list).map((h) => h.id)).toEqual(list.map((h) => h.id));
		expect(new Set(list.map((h) => h.sort_key)).size).toBe(500);
	});
});
