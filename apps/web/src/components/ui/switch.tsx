import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui switch restyled with tokens; the 44px row around it is the target.
function Switch({
	className,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-border bg-surface transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600",
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-5"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
