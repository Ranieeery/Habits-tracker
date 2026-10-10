// Generates a VAPID key pair (P-256) for Web Push and prints it. Nothing is
// written to disk: copy the lines into apps/api/.dev.vars and apps/web/.env,
// and in production use `wrangler secret put` (see apps/api/.dev.vars.example).
//
//   pnpm --filter api vapid:generate
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

const pair = await subtle.generateKey(
	{ name: "ECDSA", namedCurve: "P-256" },
	true,
	["sign", "verify"]
);
const publicKey = Buffer.from(await subtle.exportKey("raw", pair.publicKey));
const privateJwk = await subtle.exportKey("jwk", pair.privateKey);

const publicBase64Url = publicKey.toString("base64url");

console.log(`# apps/api/.dev.vars (production: wrangler secret put <NAME>)
VAPID_PUBLIC_KEY=${publicBase64Url}
VAPID_PRIVATE_KEY=${privateJwk.d}
VAPID_SUBJECT=https://habits.rxniery.workers.dev

# apps/web/.env and apps/web/.env.production (public, safe to commit)
VITE_VAPID_PUBLIC_KEY=${publicBase64Url}`);
