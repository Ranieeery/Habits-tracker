// Minimal toast: one message at a time above the tab bar, announced to
// screen readers. Enough for mutation feedback without a toast library.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tone = "error" | "success" | "info";

const TONE = {
	error: {
		border: "border-danger",
		icon: "alert-circle-outline",
		color: colors.danger.DEFAULT,
	},
	success: {
		border: "border-success",
		icon: "check-circle-outline",
		color: colors.success.hover,
	},
	info: {
		border: "border-border",
		icon: "bell-outline",
		color: colors.violet[400],
	},
} as const;

interface ToastMessage {
	id: number;
	tone: Tone;
	title: string;
	description?: string;
}

type ShowToast = (tone: Tone, title: string, description?: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

const DURATION_MS = 4000;
/** Clears the tab bar (about 64 dp) on tab screens. */
const BOTTOM_OFFSET = 80;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const nextId = useRef(0);
	const insets = useSafeAreaInsets();

	const show = useCallback<ShowToast>((tone, title, description) => {
		nextId.current += 1;
		setToast({ id: nextId.current, tone, title, description });
		AccessibilityInfo.announceForAccessibility(
			description ? `${title}. ${description}` : title
		);
	}, []);

	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), DURATION_MS);
		return () => clearTimeout(timer);
	}, [toast]);

	return (
		<ToastContext value={show}>
			{children}
			{toast ? (
				<Animated.View
					key={toast.id}
					entering={FadeInDown}
					exiting={FadeOutDown}
					pointerEvents="none"
					style={{
						position: "absolute",
						left: 16,
						right: 16,
						bottom: insets.bottom + BOTTOM_OFFSET,
					}}
				>
					<View
						className={`flex-row items-start gap-3 rounded-xl border bg-surface p-4 ${TONE[toast.tone].border}`}
					>
						<MaterialCommunityIcons
							name={TONE[toast.tone].icon}
							size={22}
							color={TONE[toast.tone].color}
						/>
						<View className="flex-1 gap-1">
							<Text className="font-semibold text-foreground">
								{toast.title}
							</Text>
							{toast.description ? (
								<Text className="text-sm text-muted">{toast.description}</Text>
							) : null}
						</View>
					</View>
				</Animated.View>
			) : null}
		</ToastContext>
	);
}

export function useToast(): ShowToast {
	const show = use(ToastContext);
	if (!show) throw new Error("useToast outside <ToastProvider>");
	return show;
}
