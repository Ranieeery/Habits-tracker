import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import globals from "globals";
import root from "../../eslint.config.js";

export default defineConfig(
	root,
	{
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			globals: { ...globals.browser },
		},
	},
	reactHooks.configs.flat["recommended-latest"],
	reactRefresh.configs.vite
);
