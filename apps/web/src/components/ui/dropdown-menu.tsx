import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";
import {
	MENU_CONTENT_CLASSES,
	MENU_ITEM_CLASSES,
	MENU_LABEL_CLASSES,
	MENU_SEPARATOR_CLASSES,
} from "./menu-styles.ts";

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
				className={cn(MENU_CONTENT_CLASSES, className)}
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
			className={cn(MENU_ITEM_CLASSES, className)}
			{...props}
		/>
	);
}

function DropdownMenuLabel({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			className={cn(MENU_LABEL_CLASSES, className)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn(MENU_SEPARATOR_CLASSES, className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
};
