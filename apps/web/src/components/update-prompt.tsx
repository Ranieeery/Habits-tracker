import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const CHECK_EVERY_MS = 60 * 60_000;

/**
 * Service worker registration and update strategy ("prompt"): a new version
 * installs in the background and waits; the user applies it from the toast,
 * which activates the new worker and reloads. Checks for a new version every
 * hour and whenever the app returns to the foreground, so an open tab or an
 * installed PWA never stays on an old build.
 */
export function UpdatePrompt() {
	const {
		needRefresh: [needRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegisteredSW(_url, registration) {
			if (!registration) return;
			const check = () => {
				if (!registration.installing && navigator.onLine) {
					void registration.update();
				}
			};
			setInterval(check, CHECK_EVERY_MS);
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible") check();
			});
		},
	});

	useEffect(() => {
		if (!needRefresh) return;
		const id = toast("Nova versão disponível", {
			description: "Atualize para usar a versão mais recente.",
			duration: Number.POSITIVE_INFINITY,
			action: {
				label: "Atualizar",
				onClick: () => void updateServiceWorker(true),
			},
		});
		return () => {
			toast.dismiss(id);
		};
	}, [needRefresh, updateServiceWorker]);

	return null;
}
