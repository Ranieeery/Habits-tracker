import { Text, View } from "react-native";
import { REMINDER_MINUTES, stepHour, withMinutes } from "@/lib/calendar.ts";
import { IconButton } from "./button.tsx";
import { Choice } from "./choice.tsx";

/**
 * Reminder time in 15-minute steps: hour with -/+ buttons (wrapping around
 * midnight) and the minutes as four choices. No native picker.
 */
export function QuarterTimePicker({
	label,
	value,
	disabled = false,
	onChange,
}: {
	label: string;
	/** `HH:MM`. */
	value: string;
	disabled?: boolean;
	onChange: (time: string) => void;
}) {
	const [hour = "20", minute = "00"] = value.split(":");
	return (
		<View className="gap-2">
			<Text className="text-sm font-semibold text-foreground">{label}</Text>
			<View className="flex-row flex-wrap items-center gap-2">
				<IconButton
					icon="minus"
					label="Uma hora antes"
					disabled={disabled}
					onPress={() => onChange(stepHour(value, -1))}
				/>
				<Text
					accessibilityLabel={`${Number(hour)} horas`}
					accessibilityLiveRegion="polite"
					className="w-10 text-center text-2xl font-bold text-foreground"
				>
					{hour}
				</Text>
				<IconButton
					icon="plus"
					label="Uma hora depois"
					disabled={disabled}
					onPress={() => onChange(stepHour(value, 1))}
				/>
				<Text className="text-2xl font-bold text-muted">:</Text>
				<View accessibilityRole="radiogroup" className="flex-row gap-1">
					{REMINDER_MINUTES.map((m) => (
						<Choice
							key={m}
							role="radio"
							label={m}
							accessibilityLabel={`${m} minutos`}
							selected={minute === m}
							disabled={disabled}
							onPress={() => onChange(withMinutes(value, m))}
						/>
					))}
				</View>
			</View>
		</View>
	);
}
