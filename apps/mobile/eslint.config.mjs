import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import root from "../../eslint.config.js";

export default defineConfig(
	root,
	{
		files: ["*.config.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: { ...globals.node },
		},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	reactHooks.configs.flat["recommended-latest"]
);
