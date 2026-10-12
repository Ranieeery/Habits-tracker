import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	LayoutGridIcon,
	ListChecksIcon,
	type LucideIcon,
	SettingsIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { TimezoneBanner } from "@/features/settings/timezone-banner.tsx";
import { useRefreshPushSubscription } from "@/features/settings/use-reminders.ts";
import { queryKeys } from "@/lib/queries.ts";
import { useToday } from "@/lib/use-today.ts";
import { cn } from "@/lib/utils.ts";
import { Wordmark } from "./wordmark.tsx";

interface NavItem {
	to: "/" | "/today" | "/habits" | "/settings";
	label: string;
	icon: LucideIcon;
}

const NAV: NavItem[] = [
	{ to: "/today", label: "Hoje", icon: CalendarCheckIcon },
	{ to: "/", label: "Histórico", icon: LayoutGridIcon },
	{ to: "/habits", label: "Hábitos", icon: ListChecksIcon },
	{ to: "/settings", label: "Ajustes", icon: SettingsIcon },
];

/** When the date turns with the app open, the heatmap gains a new day. */
function useRefreshOnNewDay() {
	const today = useToday();
	const queryClient = useQueryClient();
	const previous = useRef(today);
	useEffect(() => {
		if (previous.current === today) return;
		previous.current = today;
		void queryClient.invalidateQueries({ queryKey: queryKeys.summaries });
	}, [today, queryClient]);
}

/**
 * The heatmap screen wears the 2.4.0 identity (night tokens, wordmark, glow,
 * wider column); every other route keeps the previous look until the next
 * redesign stage moves it too.
 */
function useIsHome() {
	return useRouterState({ select: (state) => state.location.pathname === "/" });
}

function NavLinks({
	variant,
	home,
}: {
	variant: "top" | "bottom";
	home: boolean;
}) {
	return NAV.map(({ to, label, icon: Icon }) => (
		<Link
			key={to}
			to={to}
			activeOptions={{ exact: true }}
			className={cn(
				"flex min-h-touch items-center justify-center gap-2 rounded-md font-semibold transition-colors",
				home
					? "text-night-muted hover:text-night-foreground data-[status=active]:text-night-foreground"
					: "text-muted hover:text-foreground data-[status=active]:text-foreground",
				variant === "top"
					? cn(
							"px-3",
							home
								? "data-[status=active]:bg-night-surface-raised"
								: "data-[status=active]:bg-surface"
						)
					: cn(
							"flex-1 flex-col gap-0.5 py-1 text-xs",
							home
								? "data-[status=active]:text-night-accent-text"
								: "data-[status=active]:text-violet-400"
						)
			)}
		>
			<Icon className="size-5" aria-hidden="true" />
			{label}
		</Link>
	));
}

export function AppLayout() {
	useRefreshOnNewDay();
	useRefreshPushSubscription();
	const home = useIsHome();

	return (
		<div
			data-screen={home ? "home" : undefined}
			className={cn(
				"mx-auto flex min-h-dvh w-full flex-col",
				home ? "max-w-6xl text-night-foreground" : "max-w-5xl"
			)}
		>
			{home && (
				// Fixed backdrop: the night background and one soft violet glow
				// at the top (no image, nothing animated).
				<div
					aria-hidden="true"
					className="pointer-events-none fixed inset-0 -z-10 bg-night-bg bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,color-mix(in_oklab,var(--color-night-glow)_24%,transparent),transparent_70%)]"
				/>
			)}
			<header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
				<Link
					to="/"
					className="text-xl font-extrabold tracking-tight"
					aria-label="Habits, início"
				>
					{home ? (
						<Wordmark />
					) : (
						<>
							Habits<span className="text-accent">.</span>
						</>
					)}
				</Link>
				<nav aria-label="Principal" className="hidden gap-1 md:flex">
					<NavLinks variant="top" home={home} />
				</nav>
			</header>

			<main className="flex flex-1 flex-col gap-6 px-4 pb-28 md:pb-10">
				<TimezoneBanner />
				<Outlet />
			</main>

			<nav
				aria-label="Principal"
				className={cn(
					"fixed inset-x-0 bottom-0 z-40 flex border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
					home
						? "border-night-border bg-night-bg/95"
						: "border-border bg-background/95"
				)}
			>
				<NavLinks variant="bottom" home={home} />
			</nav>
		</div>
	);
}
