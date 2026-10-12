// Order of habits (2.4.0): each habit has a `sort_key`, a fractional index
// compared as a plain string. Moving a habit gives it a key between its new
// neighbors, so a reorder is a single field change (one REST call or one
// `habit.update`) that merges per field like any other edit, instead of
// renumbering the whole list.
//
// The keys follow the "fractional indexing" scheme with an integer part:
// the head character sets the length of the integer part (`a` = 1 digit,
// `b` = 2 digits…, `Z`, `Y`… for keys before `a0`), followed by an optional
// fraction that never ends in the zero digit. Appending at the end keeps keys
// short (`a0`, `a1`… `az`, `b00`…), and there is always room between two
// different keys. Digits are base 62 in ASCII order, so plain string
// comparison is the order.

import type { Habit } from "@habits/contracts";

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ZERO = DIGITS[0]!;
const LAST = DIGITS[DIGITS.length - 1]!;
/** The smallest integer part; nothing can go before it without a fraction. */
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

function integerLength(head: string): number {
	if (head >= "a" && head <= "z") return head.charCodeAt(0) - 97 + 2;
	if (head >= "A" && head <= "Z") return 90 - head.charCodeAt(0) + 2;
	throw new RangeError(`Invalid sort key head: ${head}`);
}

function integerPart(key: string): string {
	const length = integerLength(key.charAt(0));
	if (length > key.length) throw new RangeError(`Invalid sort key: ${key}`);
	return key.slice(0, length);
}

/** Whether `key` is a well-formed key of this scheme. */
export function isValidSortKey(key: string): boolean {
	if (key === "" || key === SMALLEST_INTEGER) return false;
	if ([...key].some((char) => !DIGITS.includes(char))) return false;
	try {
		const fraction = key.slice(integerPart(key).length);
		return !fraction.endsWith(ZERO);
	} catch {
		return false;
	}
}

function assertValid(key: string) {
	if (!isValidSortKey(key)) throw new RangeError(`Invalid sort key: ${key}`);
}

/** A fraction strictly between `a` and `b` (`b` null = 1). */
function midpoint(a: string, b: string | null): string {
	if (b !== null) {
		// Common prefix: keep it and look at the first digit that differs.
		let n = 0;
		while ((a.charAt(n) || ZERO) === b.charAt(n)) n++;
		if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
	}
	const digitA = a ? DIGITS.indexOf(a.charAt(0)) : 0;
	const digitB = b !== null ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length;
	if (digitB - digitA > 1) {
		return DIGITS.charAt(Math.round((digitA + digitB) / 2));
	}
	// Consecutive digits: `b` longer than one digit leaves room right at its
	// first digit; otherwise go one level deeper after `a`'s digit.
	if (b !== null && b.length > 1) return b.slice(0, 1);
	return DIGITS.charAt(digitA) + midpoint(a.slice(1), null);
}

function incrementInteger(integer: string): string | null {
	const head = integer.charAt(0);
	const digits = [...integer.slice(1)];
	let carry = true;
	for (let i = digits.length - 1; carry && i >= 0; i--) {
		const next = DIGITS.indexOf(digits[i]!) + 1;
		if (next === DIGITS.length) {
			digits[i] = ZERO;
		} else {
			digits[i] = DIGITS.charAt(next);
			carry = false;
		}
	}
	if (!carry) return head + digits.join("");
	if (head === "Z") return `a${ZERO}`;
	if (head === "z") return null;
	const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
	if (nextHead > "a") digits.push(ZERO);
	else digits.pop();
	return nextHead + digits.join("");
}

function decrementInteger(integer: string): string | null {
	const head = integer.charAt(0);
	const digits = [...integer.slice(1)];
	let borrow = true;
	for (let i = digits.length - 1; borrow && i >= 0; i--) {
		const previous = DIGITS.indexOf(digits[i]!) - 1;
		if (previous === -1) {
			digits[i] = LAST;
		} else {
			digits[i] = DIGITS.charAt(previous);
			borrow = false;
		}
	}
	if (!borrow) return head + digits.join("");
	if (head === "a") return `Z${LAST}`;
	if (head === "A") return null;
	const previousHead = String.fromCharCode(head.charCodeAt(0) - 1);
	if (previousHead < "Z") digits.push(LAST);
	else digits.pop();
	return previousHead + digits.join("");
}

/**
 * A key strictly between `a` and `b` (null = open end): `keyBetween(null,
 * null)` is the first key, `keyBetween(last, null)` appends, `keyBetween(null,
 * first)` prepends. Throws when `a >= b` or a key is malformed.
 */
export function keyBetween(a: string | null, b: string | null): string {
	if (a !== null) assertValid(a);
	if (b !== null) assertValid(b);
	if (a !== null && b !== null && a >= b) {
		throw new RangeError(`Sort keys out of order: ${a} >= ${b}`);
	}
	if (a === null) {
		if (b === null) return `a${ZERO}`;
		const intB = integerPart(b);
		const fracB = b.slice(intB.length);
		if (intB === SMALLEST_INTEGER) return intB + midpoint("", fracB);
		if (intB < b) return intB;
		const previous = decrementInteger(intB);
		if (previous === null) throw new RangeError("No sort key before this");
		return previous;
	}
	const intA = integerPart(a);
	const fracA = a.slice(intA.length);
	if (b === null) {
		const next = incrementInteger(intA);
		return next === null ? intA + midpoint(fracA, null) : next;
	}
	const intB = integerPart(b);
	if (intA === intB) return intA + midpoint(fracA, b.slice(intB.length));
	const next = incrementInteger(intA);
	if (next === null) throw new RangeError("No sort key between these");
	return next < b ? next : intA + midpoint(fracA, null);
}

/** `count` keys in order, starting at the first key (`a0`, `a1`…). */
export function initialSortKeys(count: number): string[] {
	const keys: string[] = [];
	let last: string | null = null;
	for (let i = 0; i < count; i++) {
		last = keyBetween(last, null);
		keys.push(last);
	}
	return keys;
}

type Orderable = Pick<Habit, "id" | "sort_key" | "created_at">;

/**
 * List order of habits: by `sort_key`; a habit without a key (from an API
 * older than 2.4.0, or created before it synced) goes last; ties (two
 * devices that picked the same key) by creation, then id.
 */
export function compareHabitOrder(a: Orderable, b: Orderable): number {
	if (a.sort_key !== b.sort_key) {
		if (a.sort_key === "") return 1;
		if (b.sort_key === "") return -1;
		return a.sort_key < b.sort_key ? -1 : 1;
	}
	if (a.created_at !== b.created_at) return a.created_at - b.created_at;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** A sorted copy (`compareHabitOrder`). */
export function sortHabits<H extends Orderable>(habits: readonly H[]): H[] {
	return [...habits].sort(compareHabitOrder);
}

/**
 * The key for a new habit at the end of the list: after the largest valid
 * key among the live habits (archived ones included, since they can come
 * back), or the first key when there is none.
 */
export function keyAfterLast(
	habits: Iterable<Pick<Habit, "sort_key" | "deleted_at">>
): string {
	let last: string | null = null;
	for (const habit of habits) {
		if (habit.deleted_at !== null || !isValidSortKey(habit.sort_key)) continue;
		if (last === null || habit.sort_key > last) last = habit.sort_key;
	}
	return keyBetween(last, null);
}

export interface SortKeyChange {
	habit_id: string;
	sort_key: string;
}

/**
 * The key changes that move `habitId` to `toIndex` in `ordered` (the list as
 * shown, already sorted). Normally one change: a key between the new
 * neighbors. If the neighbors' keys leave no room (missing or equal keys,
 * e.g. from an older API or two devices picking the same key), the whole
 * list gets fresh keys in the new order. An unknown habit or no move: [].
 */
export function moveHabit(
	ordered: readonly Pick<Habit, "id" | "sort_key">[],
	habitId: string,
	toIndex: number
): SortKeyChange[] {
	const from = ordered.findIndex((habit) => habit.id === habitId);
	if (from === -1) return [];
	const target = Math.max(0, Math.min(ordered.length - 1, toIndex));
	if (target === from) return [];

	const rest = ordered.filter((habit) => habit.id !== habitId);
	const before = rest[target - 1];
	const after = rest[target];
	const low = before?.sort_key ?? null;
	const high = after?.sort_key ?? null;
	const fits =
		(low === null || isValidSortKey(low)) &&
		(high === null || isValidSortKey(high)) &&
		(low === null || high === null || low < high);
	if (fits) return [{ habit_id: habitId, sort_key: keyBetween(low, high) }];

	const reordered = [...rest];
	reordered.splice(target, 0, ordered[from]!);
	const keys = initialSortKeys(reordered.length);
	return reordered
		.map((habit, index) => ({ habit_id: habit.id, sort_key: keys[index]! }))
		.filter((change, index) => reordered[index]!.sort_key !== change.sort_key);
}

/** Applies key changes to a list and returns it sorted (optimistic UI). */
export function withSortKeys<H extends Orderable>(
	habits: readonly H[],
	changes: readonly SortKeyChange[]
): H[] {
	const keys = new Map(
		changes.map((change) => [change.habit_id, change.sort_key])
	);
	return sortHabits(
		habits.map((habit) =>
			keys.has(habit.id) ? { ...habit, sort_key: keys.get(habit.id)! } : habit
		)
	);
}
