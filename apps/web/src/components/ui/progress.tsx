import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui progress bar with the legacy look (zinc track, violet fill).
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
				"relative h-3 w-full overflow-hidden rounded-lg bg-track",
				className
			)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className="h-full w-full rounded-lg bg-violet-600 transition-transform duration-300"
				style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
