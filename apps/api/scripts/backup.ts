// Exports the D1 database to backups/ at the repo root (gitignored: exports
// hold real data, never commit or upload them anywhere public).
//
//   pnpm --filter api db:backup:remote   # production (needs `wrangler login`)
//   pnpm --filter api db:backup:local    # the local dev database
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const target = process.argv.includes("--remote") ? "remote" : "local";
const dir = join(import.meta.dirname, "..", "..", "..", "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = join(dir, `habits-${target}-${stamp}.sql`);

// Wrangler from this package (lockfile version), without a shell.
const wrangler = join(
	import.meta.dirname,
	"..",
	"node_modules",
	"wrangler",
	"bin",
	"wrangler.js"
);
const result = spawnSync(
	process.execPath,
	[wrangler, "d1", "export", "DB", `--${target}`, `--output=${file}`],
	{ stdio: "inherit", cwd: join(import.meta.dirname, "..") }
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Backup written to ${relative(process.cwd(), file)}`);
