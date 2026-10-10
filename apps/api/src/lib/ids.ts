/**
 * UUID v7 (RFC 9562): 48-bit timestamp from `nowMs`, then random bits. Used
 * when a client creates a record without sending its own id.
 */
export function uuidV7(nowMs: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let time = nowMs;
	for (let i = 5; i >= 0; i--) {
		bytes[i] = time % 256;
		time = Math.floor(time / 256);
	}
	bytes[6] = (bytes[6]! & 0x0f) | 0x70;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
