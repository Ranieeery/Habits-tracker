import { uuidV7 as formatUuidV7 } from "@habits/core";

/**
 * UUID v7 with Web Crypto randomness. Used when a client creates a record
 * without sending its own id.
 */
export function uuidV7(nowMs: number): string {
	return formatUuidV7(nowMs, crypto.getRandomValues(new Uint8Array(16)));
}
