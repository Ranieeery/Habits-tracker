import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui button, restyled with the design tokens. Every size keeps the
// 44px minimum touch target.
const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
	{
		variants: {
			variant: {
				default: "bg-violet-600 text-foreground hover:bg-violet-500",
				success: "bg-success text-foreground hover:bg-success-hover",
				outline:
					"border border-accent text-foreground hover:border-accent-hover hover:bg-surface",
				secondary:
					"border border-border bg-surface text-foreground hover:bg-border",
				ghost: "text-muted hover:bg-surface hover:text-foreground",
				danger: "border border-danger/40 text-danger hover:bg-danger-surface",
				link: "text-violet-400 underline-offset-4 hover:underline",
				// 2.4.0 identity (heatmap screen only until the other screens move).
				night:
					"bg-night-accent text-night-accent-on hover:bg-night-accent-hover",
				"night-secondary":
					"border border-night-border-strong bg-night-surface text-night-foreground hover:bg-night-surface-raised",
				"night-ghost":
					"text-night-muted hover:bg-night-surface-raised hover:text-night-foreground",
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
