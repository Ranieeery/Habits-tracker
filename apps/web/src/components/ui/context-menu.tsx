import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";
import {
	MENU_CONTENT_CLASSES,
	MENU_ITEM_CLASSES,
	MENU_LABEL_CLASSES,
	MENU_SEPARATOR_CLASSES,
} from "./menu-styles.ts";

// shadcn/ui context menu (the parts the app uses), styled like the dropdown
// menu. It opens at the pointer on a right click inside its trigger only;
// the browser's own menu stays everywhere else.
function ContextMenu(
	props: React.ComponentProps<typeof ContextMenuPrimitive.Root>
) {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(
	props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>
) {
	return (
		<ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
	);
}

function ContextMenuContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				data-slot="context-menu-content"
				className={cn(MENU_CONTENT_CLASSES, className)}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
}

function ContextMenuItem({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
	return (
		<ContextMenuPrimitive.Item
			data-slot="context-menu-item"
			className={cn(MENU_ITEM_CLASSES, className)}
			{...props}
		/>
	);
}

function ContextMenuLabel({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
	return (
		<ContextMenuPrimitive.Label
			data-slot="context-menu-label"
			className={cn(MENU_LABEL_CLASSES, className)}
			{...props}
		/>
	);
}

function ContextMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
	return (
		<ContextMenuPrimitive.Separator
			data-slot="context-menu-separator"
			className={cn(MENU_SEPARATOR_CLASSES, className)}
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
};
