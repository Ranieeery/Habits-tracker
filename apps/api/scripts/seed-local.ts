// Seeds the local D1 database (the same `.wrangler/state` that `wrangler dev`
// uses) with deterministic dev data, including the Better Auth user with the
// fixed DEV_USER_ID and a password credential. Run `db:migrate:local` first.
//
//   pnpm --filter api db:seed:local [--today YYYY-MM-DD]
import { parseArgs } from "node:util";
import { CalendarDate } from "@habits/contracts";
import { getPlatformProxy } from "wrangler";
import { hashPassword } from "../src/auth/password.ts";
import { createDb } from "../src/db/client.ts";
import { applySeed } from "../src/db/seed/apply.ts";
import {
	buildSeed,
	DEFAULT_SEED_TODAY,
	DEV_USER_PASSWORD,
} from "../src/db/seed/build.ts";
import { validateSeed } from "../src/db/seed/validate.ts";

const { values } = parseArgs({
	args: process.argv.slice(2).filter((arg) => arg !== "--"),
	options: { today: { type: "string", default: DEFAULT_SEED_TODAY } },
});
const today = CalendarDate.parse(values.today);

const seed = validateSeed(buildSeed({ today }));
const { env, dispose } = await getPlatformProxy<Env>();
try {
	await applySeed(
		createDb(env.DB),
		seed,
		await hashPassword(DEV_USER_PASSWORD)
	);
	const deleted = seed.completions.filter((c) => c.deleted_at !== null).length;
	console.log(
		`Seeded user ${seed.userId} (today = ${today}): ` +
			`${seed.habits.length} habits, ${seed.completions.length} completions ` +
			`(${deleted} un-checked).\n` +
			`Sign in as ${seed.user.email} / ${DEV_USER_PASSWORD} (local only).`
	);
} finally {
	await dispose();
}
