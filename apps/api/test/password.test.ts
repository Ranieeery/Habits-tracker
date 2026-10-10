import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
	CURRENT_PARAMS,
	hashPassword,
	needsRehash,
	parseHash,
	verifyPassword,
} from "../src/auth/password.ts";
import { account } from "../src/db/schema.ts";
import {
	createUser,
	db,
	makeApi,
	PASSWORD,
	resetDb,
	signIn,
} from "./helpers.ts";

const WEAKER = { ...CURRENT_PARAMS, N: CURRENT_PARAMS.N / 2 };

describe("hashPassword", () => {
	it("writes a versioned hash with its parameters", async () => {
		const hash = await hashPassword(PASSWORD);
		expect(hash).toMatch(
			/^\$scrypt\$v=1\$n=2048,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/
		);
		expect(parseHash(hash)?.params).toEqual(CURRENT_PARAMS);
	});

	it("salts every hash", async () => {
		expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
	});
});

describe("verifyPassword", () => {
	it("accepts the right password and rejects a wrong one", async () => {
		const hash = await hashPassword(PASSWORD);
		expect(await verifyPassword(hash, PASSWORD)).toBe(true);
		expect(await verifyPassword(hash, `${PASSWORD}x`)).toBe(false);
		expect(await verifyPassword(hash, "")).toBe(false);
	});

	it("verifies with the parameters stored in the hash", async () => {
		const hash = await hashPassword(PASSWORD, WEAKER);
		expect(await verifyPassword(hash, PASSWORD)).toBe(true);
	});

	it("normalizes Unicode (NFKC) before hashing", async () => {
		const hash = await hashPassword("senha-com-acentuação-é");
		expect(
			await verifyPassword(hash, "senha-com-acentuação-é".normalize("NFD"))
		).toBe(true);
	});

	it.each([
		"",
		"salt:deadbeef",
		"$scrypt$v=1$n=2048,r=8,p=1$abc",
		"$scrypt$v=1$n=3000,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"$scrypt$v=1$n=4194304,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	])("rejects the malformed hash %j without throwing", async (hash) => {
		expect(await verifyPassword(hash, PASSWORD)).toBe(false);
	});
});

describe("needsRehash", () => {
	it("is false for current parameters and true for weaker ones", async () => {
		expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
		expect(needsRehash(await hashPassword(PASSWORD, WEAKER))).toBe(true);
		expect(
			needsRehash(await hashPassword(PASSWORD), {
				...CURRENT_PARAMS,
				r: CURRENT_PARAMS.r * 2,
			})
		).toBe(true);
	});
});

describe("re-hash on sign-in", () => {
	beforeEach(resetDb);

	it("upgrades a hash made with weaker parameters", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");
		const credential = eq(account.userId, owner.id);
		await db
			.update(account)
			.set({ password: await hashPassword(PASSWORD, WEAKER) })
			.where(credential);

		expect((await signIn(api, owner.email)).status).toBe(200);

		const [row] = await db.select().from(account).where(credential);
		expect(parseHash(row!.password!)?.params).toEqual(CURRENT_PARAMS);
		expect((await signIn(api, owner.email)).status).toBe(200);
	});

	it("keeps the hash when the password is wrong", async () => {
		const api = makeApi();
		const owner = await createUser(api, "owner@example.com");
		const weak = await hashPassword(PASSWORD, WEAKER);
		const credential = eq(account.userId, owner.id);
		await db.update(account).set({ password: weak }).where(credential);

		expect((await signIn(api, owner.email, `${PASSWORD}x`)).status).toBe(401);

		const [row] = await db.select().from(account).where(credential);
		expect(row!.password).toBe(weak);
	});
});
