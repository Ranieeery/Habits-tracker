// Web Push for Workers with Web Crypto only (no Node APIs, no dependency):
// RFC 8291 message encryption (`aes128gcm`, one record) and RFC 8292 VAPID
// (ES256 JWT). Checked against the RFC 8291 Appendix A vector in the tests.
// Payloads are small JSON (well under one 4 KB record) and unpadded.

const encoder = new TextEncoder();

/** UTF-8 bytes backed by a plain ArrayBuffer (what Web Crypto types want). */
function utf8(text: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(encoder.encode(text));
}

/** One record of up to 4096 bytes; our payloads are ~150 bytes. */
const RECORD_SIZE = 4096;
/** RFC 8292: the JWT must not be valid for more than 24 hours. */
const MAX_JWT_SECONDS = 24 * 60 * 60;

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

async function hkdf(
	salt: Uint8Array<ArrayBuffer>,
	ikm: Uint8Array<ArrayBuffer>,
	info: Uint8Array<ArrayBuffer>,
	length: number
): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt, info },
		key,
		length * 8
	);
	return new Uint8Array(bits);
}

/** JWK for a P-256 key from its uncompressed public point (and `d`). */
function p256Jwk(publicKey: Uint8Array, d?: string): JsonWebKey {
	return {
		kty: "EC",
		crv: "P-256",
		x: base64UrlEncode(publicKey.slice(1, 33)),
		y: base64UrlEncode(publicKey.slice(33, 65)),
		...(d === undefined ? {} : { d }),
		ext: true,
	};
}

export interface WebPushKeys {
	/** Browser public key (`keys.p256dh`), base64url, uncompressed P-256. */
	p256dh: string;
	/** Browser auth secret (`keys.auth`), base64url, 16 bytes. */
	auth: string;
}

export interface EncryptOptions {
	/** Test vectors only: a fixed salt. */
	salt?: Uint8Array<ArrayBuffer>;
	/** Test vectors only: a fixed sender key pair instead of a fresh one. */
	senderKeys?: { publicKey: Uint8Array<ArrayBuffer>; privateD: string };
}

/** Encrypts a payload for one subscription (`Content-Encoding: aes128gcm`). */
export async function encryptPayload(
	plaintext: Uint8Array,
	keys: WebPushKeys,
	options: EncryptOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
	const receiverPublic = base64UrlDecode(keys.p256dh);
	const authSecret = base64UrlDecode(keys.auth);
	if (receiverPublic.length !== 65 || receiverPublic[0] !== 0x04) {
		throw new Error("Invalid p256dh key");
	}
	if (authSecret.length !== 16) throw new Error("Invalid auth secret");

	let senderPrivate: CryptoKey;
	let senderPublic: Uint8Array<ArrayBuffer>;
	if (options.senderKeys) {
		senderPublic = options.senderKeys.publicKey;
		senderPrivate = await crypto.subtle.importKey(
			"jwk",
			p256Jwk(senderPublic, options.senderKeys.privateD),
			{ name: "ECDH", namedCurve: "P-256" },
			false,
			["deriveBits"]
		);
	} else {
		const pair = (await crypto.subtle.generateKey(
			{ name: "ECDH", namedCurve: "P-256" },
			true,
			["deriveBits"]
		)) as CryptoKeyPair;
		senderPrivate = pair.privateKey;
		senderPublic = new Uint8Array(
			(await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer
		);
	}

	const receiverKey = await crypto.subtle.importKey(
		"raw",
		receiverPublic,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[]
	);
	const ecdhSecret = new Uint8Array(
		await crypto.subtle.deriveBits(
			// workers-types names this field `$public`; the runtime (like the Web
			// Crypto spec) reads `public`.
			{
				name: "ECDH",
				public: receiverKey,
			} as unknown as SubtleCryptoDeriveKeyAlgorithm,
			senderPrivate,
			256
		)
	);
	// RFC 8291 §3.4: combine the ECDH secret with the auth secret.
	const keyInfo = concat(utf8("WebPush: info\0"), receiverPublic, senderPublic);
	const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
	// RFC 8188: content encryption key and nonce from the salt.
	const salt = options.salt ?? randomBytes(16);
	const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

	// A single (last) record: plaintext, then the 0x02 delimiter, no padding.
	const record = concat(plaintext, new Uint8Array([0x02]));
	if (record.length + 16 > RECORD_SIZE) throw new Error("Payload too large");
	const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
		"encrypt",
	]);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, record)
	);

	// Header: salt (16) | record size (4) | key id length (1) | sender key.
	const header = new Uint8Array(21 + senderPublic.length);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, RECORD_SIZE);
	header[20] = senderPublic.length;
	header.set(senderPublic, 21);
	return concat(header, ciphertext);
}

export interface VapidKeys {
	/** Uncompressed P-256 public key, base64url (also given to browsers). */
	publicKey: string;
	/** Private scalar `d`, base64url. */
	privateKey: string;
	/** Contact for push services (RFC 8292): an `https:` URL or `mailto:`. */
	subject: string;
}

/**
 * `Authorization` header value for a push service origin (RFC 8292):
 * `vapid t=<ES256 JWT>, k=<public key>`.
 */
export async function vapidAuthorization(
	audience: string,
	vapid: VapidKeys,
	expiresAtSeconds: number
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"jwk",
		p256Jwk(base64UrlDecode(vapid.publicKey), vapid.privateKey),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"]
	);
	const header = base64UrlEncode(
		utf8(JSON.stringify({ typ: "JWT", alg: "ES256" }))
	);
	const claims = base64UrlEncode(
		utf8(
			JSON.stringify({
				aud: audience,
				exp: expiresAtSeconds,
				sub: vapid.subject,
			})
		)
	);
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		utf8(`${header}.${claims}`)
	);
	return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`;
}

export interface WebPushTarget extends WebPushKeys {
	endpoint: string;
}

export interface WebPushOptions {
	/** Seconds the push service keeps an undelivered message. */
	ttl: number;
	urgency: "very-low" | "low" | "normal" | "high";
	/** Replaces an undelivered message with the same topic (URL-safe, <= 32). */
	topic?: string;
}

/**
 * Builds Web Push requests for one run. The VAPID JWT is signed once per push
 * service origin and reused (valid 12 h), so each extra message only costs the
 * encryption.
 */
export function createWebPushSender(vapid: VapidKeys, nowMs: number) {
	const expiresAt = Math.floor(nowMs / 1000) + MAX_JWT_SECONDS / 2;
	const authorizations = new Map<string, Promise<string>>();

	return async function buildRequest(
		target: WebPushTarget,
		payload: string,
		options: WebPushOptions
	): Promise<Request> {
		const audience = new URL(target.endpoint).origin;
		let authorization = authorizations.get(audience);
		if (!authorization) {
			authorization = vapidAuthorization(audience, vapid, expiresAt);
			authorizations.set(audience, authorization);
		}
		const body = await encryptPayload(utf8(payload), target);
		const headers: Record<string, string> = {
			Authorization: await authorization,
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream",
			TTL: String(options.ttl),
			Urgency: options.urgency,
		};
		if (options.topic) headers.Topic = options.topic;
		return new Request(target.endpoint, { method: "POST", headers, body });
	};
}
