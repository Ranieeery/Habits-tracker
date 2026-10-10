import { defineConfig } from "vitest/config";
import { baseConfig } from "./vite.config.ts";

export default defineConfig({
	test: {
		projects: [
			{
				// The React app, in jsdom.
				...baseConfig,
				test: {
					name: "app",
					environment: "jsdom",
					setupFiles: ["./src/test/setup.ts"],
					include: ["src/**/*.test.{ts,tsx}"],
					css: false,
				},
			},
			{
				// The gateway Worker: plain Fetch API, no DOM.
				test: {
					name: "worker",
					environment: "node",
					include: ["worker/**/*.test.ts"],
				},
			},
		],
	},
});
