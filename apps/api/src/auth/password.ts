// Password hashing. Deliberately lightweight scrypt so a hash fits the Workers
// free plan CPU limit (10 ms per request): N=2048, r=8 measured ~4 ms in local
// workerd, against ~70 ms for Better Auth's default (N=16384, r=16). Long
// passwords (`PASSWORD_MIN_LENGTH`), closed signup and rate limiting make up
// for it. The parameters live inside every hash, so raising `CURRENT_PARAMS`
// upgrades stored hashes on the next successful login (`needsRehash`).
//
// Format: `$scrypt$v=1$n=2048,r=8,p=1$<salt base64url>$<key base64url>`.
//
// Uses `node:crypto` (native in workerd with `nodejs_compat`, and in Node for
// the dev seed script).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export interface ScryptParams {
	/** CPU/memory cost, a power of two. */
	N: number;
	/** Block size. */
	r: number;
	/** Parallelization. */
	p: number;
	/** Derived key length in bytes. */
	keyLength: number;
}

export const HASH_VERSION = 1;

export const CURRENT_PARAMS: ScryptParams = {
	N: 2048,
	r: 8,
	p: 1,
	keyLength: 32,
};

const SALT_BYTES = 16;

/** Upper bounds so a corrupted hash can never make verification explode. */
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;

const HASH_PATTERN =
	/^\$scrypt\$v=(\d+)\$n=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

interface ParsedHash {
	version: number;
	params: ScryptParams;
	salt: Buffer;
	key: Buffer;
}

function deriveKey(
	password: string,
	salt: Buffer,
	{ N, r, p, keyLength }: ScryptParams
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize("NFKC"),
			salt,
			keyLength,
			{ N, r, p, maxmem: 256 * N * r },
			(error, key) => (error ? reject(error) : resolve(key))
		);
	});
}

function isPowerOfTwo(value: number): boolean {
	return value > 1 && (value & (value - 1)) === 0;
}

export function parseHash(stored: string): ParsedHash | null {
	const match = HASH_PATTERN.exec(stored);
	if (!match) return null;
	const [version, N, r, p] = match.slice(1, 5).map(Number) as [
		number,
		number,
		number,
		number,
	];
	const salt = Buffer.from(match[5]!, "base64url");
	const key = Buffer.from(match[6]!, "base64url");
	if (
		!isPowerOfTwo(N) ||
		N > MAX_N ||
		r < 1 ||
		r > MAX_R ||
		p < 1 ||
		p > MAX_P ||
		salt.length < SALT_BYTES ||
		key.length < 16
	) {
		return null;
	}
	return { version, params: { N, r, p, keyLength: key.length }, salt, key };
}

export async function hashPassword(
	password: string,
	params: ScryptParams = CURRENT_PARAMS
): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await deriveKey(password, salt, params);
	return `$scrypt$v=${HASH_VERSION}$n=${params.N},r=${params.r},p=${params.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Constant-time check of `password` against a stored hash. */
export async function verifyPassword(
	stored: string,
	password: string
): Promise<boolean> {
	const parsed = parseHash(stored);
	if (!parsed) return false;
	const key = await deriveKey(password, parsed.salt, parsed.params);
	return timingSafeEqual(key, parsed.key);
}

/** Whether a (valid) stored hash uses weaker parameters than the current ones. */
export function needsRehash(
	stored: string,
	current: ScryptParams = CURRENT_PARAMS
): boolean {
	const parsed = parseHash(stored);
	if (!parsed) return false;
	const { params } = parsed;
	return (
		parsed.version < HASH_VERSION ||
		params.N < current.N ||
		params.r < current.r ||
		params.p < current.p ||
		params.keyLength < current.keyLength
	);
}
