import { describe, expect, it } from "vitest";
import {
	base64UrlDecode,
	base64UrlEncode,
	createWebPushSender,
	encryptPayload,
	vapidAuthorization,
} from "../src/push/webpush.ts";
import { newVapidKeys, newWebPushKeys } from "./push-fakes.ts";

// RFC 8291 Appendix A (header and ciphertext are separate base64url values).
const RFC = {
	plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
	senderPublic:
		"BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
	senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
	receiverPublic:
		"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
	salt: "DGv6ra1nlYgDCS1FRnbzlw",
	auth: "BTBZMqHH6r4Tts7J_aSIgg",
	header:
		"DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
	ciphertext:
		"8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

function decodeJwt(token: string) {
	const [header, claims, signature] = token.split(".");
	const text = (part: string) =>
		JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
	return {
		header: text(header!),
		claims: text(claims!),
		signed: new TextEncoder().encode(`${header}.${claims}`),
		signature: base64UrlDecode(signature!),
	};
}

describe("encryptPayload (aes128gcm)", () => {
	it("matches the RFC 8291 Appendix A vector byte for byte", async () => {
		const body = await encryptPayload(
			base64UrlDecode(RFC.plaintext),
			{ p256dh: RFC.receiverPublic, auth: RFC.auth },
			{
				salt: base64UrlDecode(RFC.salt),
				senderKeys: {
					publicKey: base64UrlDecode(RFC.senderPublic),
					privateD: RFC.senderPrivate,
				},
			}
		);
		const expected = new Uint8Array([
			...base64UrlDecode(RFC.header),
			...base64UrlDecode(RFC.ciphertext),
		]);
		expect(base64UrlEncode(body)).toBe(base64UrlEncode(expected));
	});

	it("uses a fresh salt and sender key per message", async () => {
		const keys = await newWebPushKeys();
		const plaintext = new TextEncoder().encode("hello");
		const a = await encryptPayload(plaintext, keys);
		const b = await encryptPayload(plaintext, keys);
		expect(base64UrlEncode(a.slice(0, 16))).not.toBe(
			base64UrlEncode(b.slice(0, 16))
		);
		expect(base64UrlEncode(a.slice(21, 86))).not.toBe(
			base64UrlEncode(b.slice(21, 86))
		);
		// Record size 4096 and a 65-byte sender key in the header.
		expect(new DataView(a.buffer).getUint32(16)).toBe(4096);
		expect(a[20]).toBe(65);
	});

	it("rejects malformed subscription keys", async () => {
		const keys = await newWebPushKeys();
		await expect(
			encryptPayload(new Uint8Array(1), { ...keys, p256dh: "AAAA" })
		).rejects.toThrow("p256dh");
		await expect(
			encryptPayload(new Uint8Array(1), { ...keys, auth: "AAAA" })
		).rejects.toThrow("auth");
	});
});

describe("VAPID", () => {
	it("signs an ES256 JWT for the push service origin", async () => {
		const vapid = await newVapidKeys();
		const authorization = await vapidAuthorization(
			"https://push.example.com",
			vapid,
			1_800_000_000
		);
		const match = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
		expect(match?.[2]).toBe(vapid.publicKey);
		const jwt = decodeJwt(match![1]!);
		expect(jwt.header).toEqual({ typ: "JWT", alg: "ES256" });
		expect(jwt.claims).toEqual({
			aud: "https://push.example.com",
			exp: 1_800_000_000,
			sub: vapid.subject,
		});
		const publicKey = await crypto.subtle.importKey(
			"raw",
			base64UrlDecode(vapid.publicKey),
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"]
		);
		expect(
			await crypto.subtle.verify(
				{ name: "ECDSA", hash: "SHA-256" },
				publicKey,
				jwt.signature,
				jwt.signed
			)
		).toBe(true);
	});

	it("builds the request with headers and a JWT valid for at most 24 h", async () => {
		const vapid = await newVapidKeys();
		const now = Date.parse("2026-10-10T23:15:00Z");
		const build = createWebPushSender(vapid, now);
		const request = await build(
			{
				endpoint: "https://push.example.com/send/abc",
				...(await newWebPushKeys()),
			},
			'{"v":1}',
			{ ttl: 3600, urgency: "normal", topic: "reminder" }
		);
		expect(request.method).toBe("POST");
		expect(request.url).toBe("https://push.example.com/send/abc");
		expect(request.headers.get("content-encoding")).toBe("aes128gcm");
		expect(request.headers.get("ttl")).toBe("3600");
		expect(request.headers.get("urgency")).toBe("normal");
		expect(request.headers.get("topic")).toBe("reminder");
		const token = /t=([^,]+)/.exec(request.headers.get("authorization")!)![1]!;
		const { exp } = decodeJwt(token).claims as { exp: number };
		expect(exp - now / 1000).toBeGreaterThan(0);
		expect(exp - now / 1000).toBeLessThanOrEqual(24 * 3600);
	});
});
