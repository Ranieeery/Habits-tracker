import { fileURLToPath } from "node:url";
import { colors } from "@habits/design-tokens";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** Plugins and aliases shared by the app build and Vitest. */
export const baseConfig = {
	plugins: [react(), tailwindcss(), themeColorMeta()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
};

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, import.meta.dirname, "");
	const proxy = apiProxy(env.VITE_API_URL, env.API_PROXY_TARGET);

	return {
		...baseConfig,
		plugins: [
			...baseConfig.plugins,
			VitePWA({
				// Own service worker (src/sw/sw.ts): precaches the app shell now,
				// and Phase 6 adds push handling to the same file.
				strategies: "injectManifest",
				srcDir: "src/sw",
				filename: "sw.ts",
				// A new version waits until the user accepts the update prompt.
				registerType: "prompt",
				injectRegister: false,
				injectManifest: {
					globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
					// pt-BR only needs the Latin subsets of the font.
					globIgnores: [
						"**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2",
					],
				},
				manifest: {
					name: "Habits",
					short_name: "Habits",
					description: "Acompanhe seus hábitos diários",
					lang: "pt-BR",
					start_url: "/",
					scope: "/",
					display: "standalone",
					orientation: "portrait",
					theme_color: colors.background,
					background_color: colors.background,
					icons: [
						{
							src: "/android-chrome-192x192.png",
							sizes: "192x192",
							type: "image/png",
						},
						{
							src: "/android-chrome-512x512.png",
							sizes: "512x512",
							type: "image/png",
						},
					],
				},
			}),
		],
		// Fixed port: the API trusts this origin (TRUSTED_ORIGINS), so moving to
		// another port when it is busy would only break sign-in later.
		server: { port: 5173, strictPort: true, proxy },
		preview: { port: 4173, strictPort: true, proxy },
	};
});

/**
 * Proxies the API path to the local Worker, so web and API share one origin
 * in development too (session cookies without CORS).
 */
function apiProxy(
	apiUrl: string | undefined,
	target: string | undefined
): Record<string, ProxyOptions> {
	if (!apiUrl?.startsWith("/")) return {};
	if (!target) {
		throw new Error(
			"API_PROXY_TARGET is not set: copy apps/web/.env.example to apps/web/.env"
		);
	}
	return {
		[apiUrl]: {
			target,
			changeOrigin: true,
			rewrite: (path) => path.slice(apiUrl.length) || "/",
		},
	};
}

/** Sets `<meta name="theme-color">` from the design tokens. */
function themeColorMeta(): Plugin {
	return {
		name: "habits:theme-color",
		transformIndexHtml: () => [
			{
				tag: "meta",
				attrs: { name: "theme-color", content: colors.background },
				injectTo: "head",
			},
		],
	};
}
