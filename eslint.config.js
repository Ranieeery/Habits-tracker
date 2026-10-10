import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
	{
		ignores: [
			"legacy/**",
			"**/node_modules/**",
			"**/dist/**",
			"**/.expo/**",
			"**/.wrangler/**",
			"**/worker-configuration.d.ts",
			"**/expo-env.d.ts",
		],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.es2022 },
		},
		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		files: ["**/*.config.{js,cjs,mjs,ts}", "**/scripts/**"],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	prettier
);
