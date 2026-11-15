// Keeps Dependabot able to read the lockfile and the pnpm version aligned with
// the pin in "packageManager". Run by CI: `pnpm lockfile:check`.
//
// pnpm 12 writes pnpm-lock.yaml as two YAML documents when it records the
// "packageManager" version; Dependabot then creates no alerts or security
// updates. `pmOnFail: ignore` (pnpm-workspace.yaml) avoids it, so pnpm no
// longer switches versions by itself and EAS needs the version in eas.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
/** @param {string} path */
const read = (path) => readFileSync(join(root, path), "utf8");
/** @type {string[]} */
const errors = [];

if (read("pnpm-lock.yaml").startsWith("---")) {
	errors.push(
		"pnpm-lock.yaml has a leading env document (starts with ---). Dependabot " +
			'cannot read it. Keep "pmOnFail: ignore" in pnpm-workspace.yaml, delete ' +
			"the first document and run pnpm install."
	);
}

const packageManager = JSON.parse(read("package.json")).packageManager;
const pinned =
	typeof packageManager === "string" && packageManager.startsWith("pnpm@")
		? packageManager.slice("pnpm@".length)
		: undefined;
if (!pinned) {
	errors.push('package.json must pin "packageManager": "pnpm@<version>".');
} else {
	/** @type {{ build?: Record<string, { pnpm?: string }> }} */
	const eas = JSON.parse(read("apps/mobile/eas.json"));
	for (const [profile, config] of Object.entries(eas.build ?? {})) {
		if (config.pnpm !== pinned) {
			errors.push(
				`apps/mobile/eas.json build.${profile}.pnpm is ${config.pnpm ?? "unset"}, ` +
					`expected ${pinned} (from packageManager).`
			);
		}
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(error);
	process.exit(1);
}
console.log(`Lockfile has a single document; EAS pins pnpm ${pinned}.`);
