import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { pushSubscriptions } from "../src/db/schema.ts";
import {
	createUser,
	db,
	json,
	makeApi,
	resetDb,
	type TestApi,
	type TestUser,
} from "./helpers.ts";
import {
	type FakePushOptions,
	fakePushFetch,
	newVapidKeys,
	newWebPushKeys,
} from "./push-fakes.ts";

beforeEach(resetDb);

const WEB = {
	kind: "webpush",
	endpoint: "https://push.example.com/send/secret-endpoint-123",
	keys: { p256dh: "BSecretP256dhKeyValue", auth: "SecretAuthValue" },
	device_label: "Chrome",
};
const EXPO = {
	kind: "expo",
	token: "ExponentPushToken[secret-expo-token-456]",
	device_label: "Pixel 9",
};
/** Credential values: never in any response. */
const SECRET_VALUES = [
	WEB.endpoint,
	WEB.keys.p256dh,
	WEB.keys.auth,
	EXPO.token,
	"secret-",
];
/** Credential fields: never in a subscription (errors may name the field). */
const SECRET_FIELDS = ["endpoint", "p256dh", '"auth"', "token"];

function register(api: TestApi, owner: TestUser, body: unknown) {
	return api.request(
		"/v1/push/subscriptions",
		json(body, { method: "POST", headers: owner.auth() })
	);
}

/** Reads the raw body and fails if any credential leaks into it. */
async function expectNoSecrets(response: Response): Promise<unknown> {
	const text = await response.text();
	const forbidden = response.ok
		? [...SECRET_VALUES, ...SECRET_FIELDS]
		: SECRET_VALUES;
	for (const secret of forbidden) expect(text).not.toContain(secret);
	return text ? JSON.parse(text) : null;
}

describe("POST /v1/push/subscriptions", () => {
	it.each([
		["webpush", WEB],
		["expo", EXPO],
	])(
		"stores a %s subscription without returning its credentials",
		async (kind, body) => {
			const api = makeApi("2026-10-09T15:00:00Z");
			const owner = await createUser(api, "owner@example.com");

			const response = await register(api, owner, body);

			expect(response.status).toBe(200);
			const now = Date.parse("2026-10-09T15:00:00Z");
			const { subscription } = (await expectNoSecrets(response)) as {
				subscription: Record<string, unknown>;
			};
			expect(subscription).toEqual({
				id: expect.any(String),
				kind,
				device_label: body.device_label,
				last_seen_at: now,
				created_at: now,
				updated_at: now,
			});
			const [row] = await db
				.select()
				.from(pushSubscriptions)
				.where(eq(pushSubscriptions.user_id, owner.id));
			expect(row).toMatchObject(
				kind === "webpush"
					? {
							endpoint: WEB.endpoint,
							p256dh: WEB.keys.p256dh,
							auth: WEB.keys.auth,
						}
					: { token: EXPO.token }
			);
		}
	);

	it("refreshes a re-registered device in place", async () => {
		const api = makeApi("2026-10-09T15:00:00Z");
		const owner = await createUser(api, "owner@example.com");
		const first = (await expectNoSecrets(await register(api, owner, WEB))) as {
			subscription: { id: string };
		};

		api.setNow("2026-10-10T15:00:00Z");
		const rotated = {
			...WEB,
			keys: { p256dh: "BRotatedKey", auth: "RotatedAuth" },
		};
		const second = await register(api, owner, {
			...rotated,
			device_label: undefined,
		});

		const { subscription } = (await expectNoSecrets(second)) as {
			subscription: { id: string; last_seen_at: number; device_label: string };
		};
		expect(subscription.id).toBe(first.subscription.id);
		expect(subscription.device_label).toBe("Chrome");
		expect(subscription.last_seen_at).toBe(Date.parse("2026-10-10T15:00:00Z"));
		expect(await db.$count(pushSubscriptions)).toBe(1);
		const row = await db.query.pushSubscriptions.findFirst();
		expect(row?.p256dh).toBe("BRotatedKey");
	});

	it("moves a device to the user who registers it", async () => {
		const api = makeApi(undefined, { ALLOW_SIGNUP: "true" });
		const alice = await createUser(api, "alice@example.com");
		const bob = await createUser(api, "bob@example.com");

		await register(api, alice, EXPO);
		const response = await register(api, bob, EXPO);

		expect(response.status).toBe(200);
		const rows = await db.select().from(pushSubscriptions);
		expect(rows.map((row) => row.user_id)).toEqual([bob.id]);
	});

	it("keeps credentials out of validation errors", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");

		const response = await register(api, owner, {
			...WEB,
			endpoint: "not a url",
		});

		expect(response.status).toBe(422);
		await expectNoSecrets(response);
	});
});

describe("DELETE /v1/push/subscriptions/{subscription_id}", () => {
	it("removes the device (hard delete)", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");
		const { subscription } = (await (
			await register(api, owner, EXPO)
		).json()) as {
			subscription: { id: string };
		};
		const remove = () =>
			api.request(`/v1/push/subscriptions/${subscription.id}`, {
				method: "DELETE",
				headers: owner.auth(),
			});

		const response = await remove();
		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
		expect(await db.$count(pushSubscriptions)).toBe(0);
		expect((await remove()).status).toBe(404);
	});
});

describe("POST /v1/push/test", () => {
	async function setupTest(fakeOptions: FakePushOptions = {}) {
		const vapid = await newVapidKeys();
		const fake = fakePushFetch(fakeOptions);
		const api = makeApi(
			"2026-10-10T15:00:00Z",
			{
				VAPID_PUBLIC_KEY: vapid.publicKey,
				VAPID_PRIVATE_KEY: vapid.privateKey,
				VAPID_SUBJECT: vapid.subject,
			},
			{ fetch: fake.fetch }
		);
		const owner = await createUser(api, "owner@example.com");
		const sendTest = () =>
			api.request("/v1/push/test", {
				method: "POST",
				headers: owner.auth(),
			});
		return { api, owner, fake, sendTest };
	}

	const realWeb = async () => ({
		...WEB,
		keys: await newWebPushKeys(),
	});

	it("sends to every device and answers counts only", async () => {
		const { api, owner, fake, sendTest } = await setupTest({
			web: { [WEB.endpoint]: 410 },
		});
		const web = await realWeb();
		await register(api, owner, web);
		await register(api, owner, EXPO);

		const response = await sendTest();

		expect(response.status).toBe(200);
		const body = (await expectNoSecrets(response)) as Record<string, number>;
		expect(body).toEqual({ sent: 1, failed: 0, removed: 1 });
		expect(fake.web()).toHaveLength(1);
		expect(fake.expoSends()[0]).toEqual([
			expect.objectContaining({
				to: EXPO.token,
				data: { url: "/day/hoje", kind: "test" },
			}),
		]);
		// The web payload is encrypted: no plaintext on the wire.
		const [request] = fake.web();
		expect(request!.headers.get("content-encoding")).toBe("aes128gcm");
		expect(new TextDecoder().decode(request!.body as Uint8Array)).not.toContain(
			"Habits"
		);
	});

	it("answers zero counts without devices", async () => {
		const { sendTest, fake } = await setupTest();

		const response = await sendTest();

		expect(await response.json()).toEqual({ sent: 0, failed: 0, removed: 0 });
		expect(fake.requests).toHaveLength(0);
	});

	it("allows one test per minute", async () => {
		const { api, sendTest } = await setupTest();

		expect((await sendTest()).status).toBe(200);
		const limited = await sendTest();
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBe("60");
		expect(await limited.json()).toMatchObject({
			error: { code: "rate_limited" },
		});

		api.setNow("2026-10-10T15:00:59Z");
		expect((await sendTest()).status).toBe(429);
		api.setNow("2026-10-10T15:01:00Z");
		expect((await sendTest()).status).toBe(200);
	});

	it("lets only one of two simultaneous tests through", async () => {
		const { sendTest } = await setupTest();

		const statuses = (await Promise.all([sendTest(), sendTest()])).map(
			(response) => response.status
		);

		expect(statuses.sort()).toEqual([200, 429]);
	});

	it("needs a session", async () => {
		const api = makeApi();
		const response = await api.request("/v1/push/test", { method: "POST" });
		expect(response.status).toBe(401);
	});
});
