import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nightColors } from "@habits/design-tokens";
import { View } from "react-native";

/** Visual only: the whole row around it is the touch target. */
export function CheckboxBox({ checked }: { checked: boolean }) {
	return (
		<View
			className={`size-8 items-center justify-center rounded-md border-2 ${checked ? "border-success bg-success" : "border-border bg-surface"}`}
		>
			{checked ? (
				<MaterialCommunityIcons
					name="check-bold"
					size={20}
					// The bg on the success green reads at about 10:1 (white: about 1.9:1).
					color={nightColors.bg}
				/>
			) : null}
		</View>
	);
}
