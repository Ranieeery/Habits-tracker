import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch.tsx";

/**
 * One switch setting, like the mobile's: icon, title, description and the
 * switch, all in one card that is the click target (44px+).
 */
export function SettingRow({
	id,
	icon: Icon,
	title,
	description,
	checked,
	disabled,
	describedBy,
	onCheckedChange,
}: {
	id: string;
	icon: LucideIcon;
	title: ReactNode;
	description: ReactNode;
	checked: boolean;
	disabled?: boolean;
	describedBy?: string;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<label
			htmlFor={id}
			className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded-xl border border-night-border bg-night-surface px-4 py-3 transition-colors hover:border-night-border-strong"
		>
			<span className="flex min-w-0 items-center gap-3">
				<Icon className="size-5 shrink-0 text-night-muted" aria-hidden="true" />
				<span className="flex min-w-0 flex-col">
					<span className="font-semibold">{title}</span>
					<span className="text-sm text-night-muted">{description}</span>
				</span>
			</span>
			<Switch
				id={id}
				checked={checked}
				disabled={disabled}
				aria-describedby={describedBy}
				onCheckedChange={onCheckedChange}
			/>
		</label>
	);
}
