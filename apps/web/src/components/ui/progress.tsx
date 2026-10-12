import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui progress bar: night track, accent fill.
// `value` is a percentage, 0-100.
function Progress({
	className,
	value,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			value={value}
			className={cn(
				"relative h-2 w-full overflow-hidden rounded-full bg-night-surface-raised",
				className
			)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className="h-full w-full rounded-full bg-night-accent motion-safe:transition-transform motion-safe:duration-300"
				style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
