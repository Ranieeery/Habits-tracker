import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
	APPROVAL_MARKER,
	findDestructive,
} from "../scripts/migration-guard.ts";

describe("findDestructive", () => {
	it("accepts additive statements", () => {
		const sql = [
			"CREATE TABLE `a` (`id` text PRIMARY KEY NOT NULL);",
			"ALTER TABLE `habits` ADD `color` text;",
			"CREATE INDEX `a_idx` ON `a` (`id`);",
			"UPDATE `habits` SET `color` = 'violet' WHERE `color` IS NULL;",
		].join("--> statement-breakpoint\n");
		expect(findDestructive("0009_add.sql", sql)).toEqual([]);
	});

	it.each([
		["DROP", "DROP TABLE `habits`;"],
		["DROP", "ALTER TABLE `habits` DROP COLUMN `name`;"],
		["DROP", "DROP INDEX `habits_user_idx`;"],
		["DROP", "DROP TRIGGER habits_seq_insert;"],
		["RENAME", "ALTER TABLE `habits` RENAME TO `old_habits`;"],
		["RENAME", "ALTER TABLE `habits` RENAME COLUMN `name` TO `title`;"],
		["DELETE", "DELETE FROM `completions` WHERE `deleted_at` IS NOT NULL;"],
	])("flags %s in %s", (rule, statement) => {
		const sql = `CREATE TABLE \`x\` (\`id\` text);\n${statement}\n`;
		expect(findDestructive("0009_bad.sql", sql)).toEqual([
			expect.objectContaining({ rule, line: 2 }),
		]);
	});

	it("ignores keywords inside comments", () => {
		const sql = "-- DROP TABLE habits\n/* DELETE FROM x */\nSELECT 1;";
		expect(findDestructive("0009_comment.sql", sql)).toEqual([]);
	});

	it("accepts a file with the approval marker", () => {
		const sql = `${APPROVAL_MARKER} contract after 2.1 (old column unused)\nALTER TABLE \`habits\` DROP COLUMN \`legacy\`;`;
		expect(findDestructive("0010_contract.sql", sql)).toEqual([]);
	});

	it("passes every committed migration", () => {
		for (const migration of env.TEST_MIGRATIONS) {
			const sql = migration.queries.join(";\n");
			expect(findDestructive(`${migration.name}`, sql), migration.name).toEqual(
				[]
			);
		}
	});
});
