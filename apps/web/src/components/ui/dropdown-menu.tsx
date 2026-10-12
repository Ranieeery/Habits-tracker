import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui dropdown menu (the parts the app uses), night tokens. Radix gives
// the menu roles, arrow-key navigation, typeahead, Esc and focus return.
function DropdownMenu(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>
) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>
) {
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			{...props}
		/>
	);
}

function DropdownMenuContent({
	className,
	align = "end",
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-50 min-w-48 rounded-xl border border-night-border bg-night-surface-overlay p-1 text-night-foreground shadow-xl shadow-night-bg/70",
					className
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

function DropdownMenuItem({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			className={cn(
				"flex min-h-touch cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-night-surface-raised [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-night-muted",
				className
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
};
