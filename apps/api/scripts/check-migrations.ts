// Fails when a migration in migrations/ drops, renames or deletes without the
// approval marker. Run by CI before any deploy: `pnpm --filter api
// migrations:check`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVAL_MARKER, findDestructive } from "./migration-guard.ts";

const dir = join(import.meta.dirname, "..", "migrations");
const files = readdirSync(dir)
	.filter((name) => name.endsWith(".sql"))
	.sort();

const violations = files.flatMap((file) =>
	findDestructive(file, readFileSync(join(dir, file), "utf8"))
);

if (violations.length > 0) {
	for (const v of violations) {
		console.error(`${v.file}:${v.line} ${v.rule}: ${v.statement}`);
	}
	console.error(
		`\nDestructive migration statements found. Migrations must be additive ` +
			`(expand/contract, see README.md). If this one is the approved ` +
			`"contract" step, add a line "${APPROVAL_MARKER} <reason>" to the file.`
	);
	process.exit(1);
}
console.log(`${files.length} migrations checked: additive only.`);
