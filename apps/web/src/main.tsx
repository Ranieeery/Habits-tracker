import { createApiClient } from "@habits/api-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { UpdatePrompt } from "./components/update-prompt.tsx";
import { createAuthService } from "./lib/auth.ts";
import { systemClock, systemTimeZone } from "./lib/services.ts";
import { createAppRouter } from "./router.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

if (!import.meta.env.VITE_API_URL) {
	throw new Error(
		"VITE_API_URL is not set: copy apps/web/.env.example to .env"
	);
}
// Relative values (`/api`) resolve against this origin: same-origin cookies.
const apiBaseUrl = new URL(
	import.meta.env.VITE_API_URL,
	window.location.origin
).href.replace(/\/$/, "");

const router = createAppRouter({
	api: createApiClient({ baseUrl: apiBaseUrl }),
	auth: createAuthService(apiBaseUrl),
	now: systemClock,
	deviceTimeZone: systemTimeZone,
});

createRoot(root).render(
	<StrictMode>
		<App router={router}>
			<UpdatePrompt />
		</App>
	</StrictMode>
);
