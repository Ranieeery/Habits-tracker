// Turns a `wrangler d1 export` dump into a file that restores into an EMPTY
// D1 database (see sql-dump.ts for why the export cannot be applied as is).
//
//   node scripts/restore-prepare.ts <dump.sql>   # writes <dump>.restore.sql
//
// Then: wrangler d1 execute <db> --local|--remote --file <dump>.restore.sql
import { readFileSync, writeFileSync } from "node:fs";
import { orderForRestore } from "./sql-dump.ts";

const input = process.argv.slice(2).find((arg) => arg !== "--");
if (!input) {
	console.error("Usage: node scripts/restore-prepare.ts <dump.sql>");
	process.exit(1);
}
const output = input.replace(/(\.sql)?$/, ".restore.sql");
const { sql, counts } = orderForRestore(readFileSync(input, "utf8"));
writeFileSync(output, sql);
console.log(`Wrote ${output}`, counts);
