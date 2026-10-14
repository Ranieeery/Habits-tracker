import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui button, restyled with the night design tokens. Every size keeps the
// 44px minimum touch target.
const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
	{
		variants: {
			variant: {
				// One primary action per area (DESIGN.md).
				default:
					"bg-night-accent text-night-accent-on hover:bg-night-accent-hover",
				// Green only confirms "done"; dark text keeps 9.8:1.
				success: "bg-night-success text-night-bg hover:brightness-110",
				outline:
					"border border-night-border-strong text-night-foreground hover:border-night-accent-text hover:bg-night-surface-raised",
				secondary:
					"border border-night-border-strong bg-night-surface text-night-foreground hover:bg-night-surface-raised",
				ghost:
					"text-night-muted hover:bg-night-surface-raised hover:text-night-foreground",
				danger:
					"border border-night-danger/40 text-night-danger hover:bg-night-danger-surface",
				// A careful action (2.16.2: "Descartar"): the warning token, never red.
				careful:
					"border border-night-warning/50 text-night-warning hover:bg-night-warning-surface",
				link: "text-night-accent-text underline-offset-4 hover:underline",
			},
			size: {
				default: "min-h-touch px-4",
				sm: "min-h-touch px-3 text-xs",
				icon: "size-touch",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	type = "button",
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			type={asChild ? undefined : type}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn pattern: links styled as buttons reuse the variants
export { Button, buttonVariants };
