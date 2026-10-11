import { describe, expect, it } from "vitest";
import { orderForRestore, splitStatements } from "../scripts/sql-dump.ts";

// Shaped like `wrangler d1 export`: each table followed by its rows, in name
// order, and the triggers at the end.
const DUMP = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE \`account\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL REFERENCES \`user\`(\`id\`)
);
INSERT INTO "account" ("id","user_id") VALUES('a1','u1');
CREATE TABLE \`habits\` (\`id\` text PRIMARY KEY, \`name\` text, \`server_seq\` integer);
INSERT INTO "habits" ("id","name","server_seq") VALUES('h1','Ler; depois -- correr',7);
INSERT INTO "habits" ("id","name","server_seq") VALUES('h2','It''s "ok"
END;',8);
CREATE TABLE \`user\` (\`id\` text PRIMARY KEY NOT NULL);
INSERT INTO "user" ("id") VALUES('u1');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',5);
CREATE INDEX \`habits_name_idx\` ON \`habits\` (\`name\`);
CREATE TRIGGER \`habits_seq\` AFTER INSERT ON \`habits\`
BEGIN
	UPDATE habits SET server_seq = 0 WHERE rowid = NEW.rowid;
END;
`;

describe("splitStatements", () => {
	it("keeps quoted semicolons, comments and trigger bodies intact", () => {
		const statements = splitStatements(DUMP);
		expect(statements).toHaveLength(12);
		expect(statements[4]).toContain("'Ler; depois -- correr'");
		expect(statements[5]).toContain("It''s \"ok\"\nEND;'");
		expect(statements[11]).toMatch(/^CREATE TRIGGER[\s\S]*END;$/);
	});
});

describe("orderForRestore", () => {
	it("creates every table before any row, and triggers last", () => {
		const { sql, counts } = orderForRestore(DUMP);
		const statements = splitStatements(sql);
		const kinds = statements.map((s) => s.split(/\s+/).slice(0, 2).join(" "));
		expect(kinds).toEqual([
			"PRAGMA defer_foreign_keys=TRUE;",
			"CREATE TABLE",
			"CREATE TABLE",
			"CREATE TABLE",
			"INSERT INTO",
			"INSERT INTO",
			"INSERT INTO",
			"INSERT INTO",
			"DELETE FROM",
			"INSERT INTO",
			"CREATE INDEX",
			"CREATE TRIGGER",
		]);
		expect(counts).toMatchObject({ table: 3, row: 6, trigger: 1, other: 0 });
		// sqlite_sequence is cleared before its rows, as in the dump.
		expect(statements[8]).toBe("DELETE FROM sqlite_sequence;");
	});
});
