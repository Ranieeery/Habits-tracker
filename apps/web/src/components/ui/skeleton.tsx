import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui skeleton.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden="true"
			className={cn(
				"rounded-md bg-night-surface-raised motion-safe:animate-pulse",
				className
			)}
			{...props}
		/>
	);
}

export { Skeleton };
