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
import { Backdrop } from "./backdrop.tsx";
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
 * The current section stands out by more than color: on top, an accent-tinted
 * pill with an inner ring; at the bottom, a pill behind the icon and a bar on
 * the item's top edge. Accent text is 9.5:1 on the background. Hovering an
 * inactive item draws a ring in the text color (pill on top, around the icon
 * at the bottom), so the pointer always shows where it is. The router
 * marks the active link (`data-status`, `aria-current="page"`).
 */
function NavLinks({ variant }: { variant: "top" | "bottom" }) {
	return NAV.map(({ to, label, icon: Icon }) => (
		<Link
			key={to}
			to={to}
			// A habit's page (/habits/$habitId, 2.12.0) belongs to Hábitos.
			activeOptions={{ exact: to !== "/habits" }}
			className={cn(
				"group relative flex min-h-touch items-center justify-center gap-2 rounded-md font-semibold text-night-muted transition-colors duration-150 hover:text-night-foreground data-[status=active]:text-night-accent-text",
				variant === "top"
					? "px-3 inset-ring inset-ring-transparent transition-[color,background-color,box-shadow] not-data-[status=active]:hover:bg-night-surface-raised not-data-[status=active]:hover:inset-ring-night-foreground/45 data-[status=active]:bg-night-accent/15 data-[status=active]:inset-ring-night-accent/40"
					: "flex-1 flex-col gap-0.5 py-1 text-xs before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full before:bg-night-accent-text before:opacity-0 before:transition-opacity data-[status=active]:before:opacity-100"
			)}
		>
			{variant === "top" ? (
				<Icon className="size-5" aria-hidden="true" />
			) : (
				<span className="flex h-7 w-12 items-center justify-center rounded-full inset-ring inset-ring-transparent transition-[color,background-color,box-shadow] duration-150 group-hover:group-not-data-[status=active]:bg-night-surface-raised group-hover:group-not-data-[status=active]:inset-ring-night-foreground/45 group-data-[status=active]:bg-night-accent/15">
					<Icon className="size-5" aria-hidden="true" />
				</span>
			)}
			{label}
		</Link>
	));
}

/**
 * The shared frame (2.4.0 identity): wordmark, navigation (top from `md`,
 * bottom bar on phones) and the night backdrop. Screens set their own
 * reading width inside the `max-w-6xl` column.
 */
export function AppLayout() {
	useRefreshOnNewDay();
	useRefreshPushSubscription();

	return (
		<div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
			<Backdrop />
			<header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
				<Link to="/" aria-label="Habits, início" className="rounded-md">
					<Wordmark />
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
				className="fixed inset-x-0 bottom-0 z-40 flex border-t border-night-border bg-night-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
			>
				<NavLinks variant="bottom" />
			</nav>
		</div>
	);
}
