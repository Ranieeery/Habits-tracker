// Reorders a `wrangler d1 export` dump so it can be restored into an empty
// database. The export writes each table followed by its rows, in name order,
// so `account` rows come before the `user` table exists ("no such table:
// main.user"), even with `PRAGMA defer_foreign_keys`. It also creates the
// sync triggers last, which must stay last: rows inserted while they exist
// would get new `server_seq` values. Pure, so the API tests cover it.

/** Splits SQL into statements (each with its `;`), keeping quoted text intact. */
export function splitStatements(sql: string): string[] {
	const statements: string[] = [];
	let start = 0;
	let i = 0;
	while (i < sql.length) {
		const char = sql[i]!;
		if (char === "'" || char === '"' || char === "`" || char === "[") {
			const close = char === "[" ? "]" : char;
			i += 1;
			while (i < sql.length) {
				if (sql[i] === close) {
					// A doubled quote is an escaped quote inside the string.
					if (close !== "]" && sql[i + 1] === close) i += 2;
					else break;
				} else i += 1;
			}
			i += 1;
		} else if (char === "-" && sql[i + 1] === "-") {
			while (i < sql.length && sql[i] !== "\n") i += 1;
		} else if (char === "/" && sql[i + 1] === "*") {
			const end = sql.indexOf("*/", i + 2);
			i = end === -1 ? sql.length : end + 2;
		} else if (char === ";") {
			const statement = sql.slice(start, i + 1);
			// A trigger body has its own `;`: the statement ends at `END;`.
			if (!isTrigger(statement) || /\bEND\s*;$/i.test(statement)) {
				if (statement.trim() !== ";") statements.push(statement.trim());
				start = i + 1;
			}
			i += 1;
		} else i += 1;
	}
	const rest = sql.slice(start).trim();
	if (rest) statements.push(rest);
	return statements;
}

function isTrigger(statement: string): boolean {
	return /^\s*CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(
		withoutLeadingComments(statement)
	);
}

function withoutLeadingComments(statement: string): string {
	return statement.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*/, "");
}

const ORDER: { kind: string; pattern: RegExp }[] = [
	{ kind: "pragma", pattern: /^PRAGMA\b/i },
	{ kind: "table", pattern: /^CREATE\s+TABLE\b/i },
	// Data statements keep their relative order (the export clears
	// sqlite_sequence before inserting its rows).
	{ kind: "row", pattern: /^(INSERT|DELETE|UPDATE|REPLACE)\b/i },
	{ kind: "index", pattern: /^CREATE\s+(UNIQUE\s+)?INDEX\b/i },
	{ kind: "view", pattern: /^CREATE\s+VIEW\b/i },
	{ kind: "trigger", pattern: /^CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i },
];

/**
 * The dump's statements in restore order: pragmas, every table, the data
 * statements, indexes, views, triggers, then anything unrecognized (kept, in
 * order).
 */
export function orderForRestore(sql: string): {
	sql: string;
	counts: Record<string, number>;
} {
	const groups = new Map<string, string[]>(
		[...ORDER.map(({ kind }) => kind), "other"].map((kind) => [kind, []])
	);
	for (const statement of splitStatements(sql)) {
		const head = withoutLeadingComments(statement);
		const kind = ORDER.find(({ pattern }) => pattern.test(head))?.kind;
		groups.get(kind ?? "other")!.push(statement);
	}
	const counts = Object.fromEntries(
		[...groups].map(([kind, list]) => [kind, list.length])
	);
	return { sql: [...groups.values()].flat().join("\n") + "\n", counts };
}
