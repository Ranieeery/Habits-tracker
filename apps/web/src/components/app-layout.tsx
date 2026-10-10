import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
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

function NavLinks({ variant }: { variant: "top" | "bottom" }) {
	return NAV.map(({ to, label, icon: Icon }) => (
		<Link
			key={to}
			to={to}
			activeOptions={{ exact: true }}
			className={cn(
				"flex min-h-touch items-center justify-center gap-2 rounded-md font-semibold text-muted transition-colors hover:text-foreground data-[status=active]:text-foreground",
				variant === "top"
					? "px-3 data-[status=active]:bg-surface"
					: "flex-1 flex-col gap-0.5 py-1 text-xs data-[status=active]:text-violet-400"
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

	return (
		<div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
			<header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
				<Link
					to="/"
					className="text-xl font-extrabold tracking-tight"
					aria-label="Habits, início"
				>
					Habits<span className="text-accent">.</span>
				</Link>
				<nav aria-label="Principal" className="hidden gap-1 md:flex">
					<NavLinks variant="top" />
				</nav>
			</header>

			<main className="flex flex-1 flex-col gap-6 px-4 pb-28 md:pb-10">
				<TimezoneBanner />
				<Outlet />
			</main>

			<nav
				aria-label="Principal"
				className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
			>
				<NavLinks variant="bottom" />
			</nav>
		</div>
	);
}
