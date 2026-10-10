// Deterministic stand-ins for randomness, so the seed is identical on every
// run for the same reference date.
import { type CalendarDate, epochDayOf } from "@habits/core";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** America/Sao_Paulo is UTC-3 with no DST since 2019. */
const SAO_PAULO_OFFSET_HOURS = -3;

/**
 * FNV-1a, 32 bits, plus the murmur3 finalizer so keys that differ only in the
 * last character (consecutive dates) still get unrelated high bits.
 */
function fnv1a(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	hash ^= hash >>> 16;
	hash = Math.imul(hash, 0x85ebca6b);
	hash ^= hash >>> 13;
	hash = Math.imul(hash, 0xc2b2ae35);
	hash ^= hash >>> 16;
	return hash >>> 0;
}

/** Pseudo-random number in [0, 1) derived from `key`. */
export function unitHash(key: string): number {
	return fnv1a(key) / 2 ** 32;
}

function hexHash(key: string, length: number): string {
	let hex = "";
	for (let round = 0; hex.length < length; round++) {
		hex += fnv1a(`${key}#${round}`).toString(16).padStart(8, "0");
	}
	return hex.slice(0, length);
}

/**
 * UUID v7 whose timestamp is `instantMs` and whose "random" bits come from
 * `key`: the same inputs always give the same id.
 */
export function uuidV7(instantMs: number, key: string): string {
	const time = instantMs.toString(16).padStart(12, "0");
	const rand = hexHash(key, 19);
	const variant = "89ab"[Number.parseInt(rand[3]!, 16) & 3];
	return [
		time.slice(0, 8),
		time.slice(8, 12),
		`7${rand.slice(0, 3)}`,
		`${variant}${rand.slice(4, 7)}`,
		rand.slice(7, 19),
	].join("-");
}

/** UTC ms of `hour:minute` local time in São Paulo on `date`. */
export function saoPauloInstant(
	date: CalendarDate,
	hour: number,
	minute = 0
): number {
	return (
		epochDayOf(date) * MS_PER_DAY +
		(hour - SAO_PAULO_OFFSET_HOURS) * MS_PER_HOUR +
		minute * 60_000
	);
}
