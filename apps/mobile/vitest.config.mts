import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure app logic only (formatting, labels, error mapping, layout math): no
// React Native modules, no component tests.
export default defineConfig({
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
