import { defineConfig } from "vitest/config";
import { baseConfig } from "./vite.config.ts";

export default defineConfig({
	...baseConfig,
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		css: false,
	},
});
