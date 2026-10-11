/**
 * UUID v7 (RFC 9562): 48-bit timestamp from `nowMs`, then random bits. The
 * caller passes 16 random bytes (Web Crypto on the API, expo-crypto on the
 * phone), so this stays pure. Only the last 10 bytes are used.
 */
export function uuidV7(nowMs: number, random: Uint8Array): string {
	if (random.length < 16) throw new RangeError("uuidV7 needs 16 random bytes");
	const bytes = Uint8Array.from(random.subarray(0, 16));
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
