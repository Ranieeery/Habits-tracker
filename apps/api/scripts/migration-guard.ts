// Rules of the destructive migration check (`pnpm --filter api
// migrations:check`), pure so the API tests can cover them. Production runs
// the newest API next to older mobile builds with pending outboxes, so a
// migration must only add (expand); removing or renaming (contract) is a
// separate, explicitly approved step. See "Mudança destrutiva em duas etapas"
// in README.md.

/** A file containing this line may run destructive statements. */
export const APPROVAL_MARKER = "-- migration-guard: destructive-ok";

/**
 * Migrations applied before the guard existed. `0002_user_fk.sql` rebuilds
 * tables to add foreign keys (DROP + RENAME) and deletes orphan rows. Applied
 * migrations are never edited, so they are listed here instead of marked.
 */
export const GRANDFATHERED: readonly string[] = ["0002_user_fk.sql"];

const RULES: { name: string; pattern: RegExp }[] = [
	{ name: "DROP", pattern: /\bDROP\s+(TABLE|COLUMN|INDEX|TRIGGER|VIEW)\b/i },
	{ name: "RENAME", pattern: /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i },
	{ name: "DELETE", pattern: /\bDELETE\s+FROM\b/i },
];

export interface Violation {
	file: string;
	rule: string;
	/** 1-based line where the statement starts. */
	line: number;
	statement: string;
}

/** Replaces SQL comments with spaces, keeping line numbers. */
function stripComments(sql: string): string {
	return sql
		.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
		.replace(/--[^\n]*/g, (comment) => " ".repeat(comment.length));
}

/** Destructive statements of one migration file (none if approved). */
export function findDestructive(file: string, sql: string): Violation[] {
	if (GRANDFATHERED.includes(file)) return [];
	if (sql.split("\n").some((line) => line.trim().startsWith(APPROVAL_MARKER))) {
		return [];
	}
	const code = stripComments(sql);
	const violations: Violation[] = [];
	let offset = 0;
	for (const statement of code.split(";")) {
		for (const rule of RULES) {
			if (!rule.pattern.test(statement)) continue;
			const leading = statement.length - statement.trimStart().length;
			const line = code.slice(0, offset + leading).split("\n").length;
			violations.push({
				file,
				rule: rule.name,
				line,
				statement: statement.trim().replace(/\s+/g, " ").slice(0, 120),
			});
		}
		offset += statement.length + 1;
	}
	return violations;
}
