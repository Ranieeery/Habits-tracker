// Minimal toast: one message at a time above the tab bar, announced to
// screen readers. Enough for mutation feedback without a toast library. A
// toast may carry one action ("Desfazer"): then it stays a little longer and
// only its button takes touches (the rest lets them through).
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@habits/design-tokens";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
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

interface ToastAction {
	label: string;
	onPress: () => void;
}

interface ToastOptions {
	action?: ToastAction;
	durationMs?: number;
}

interface ToastMessage {
	id: number;
	tone: Tone;
	title: string;
	description?: string;
	action?: ToastAction;
	durationMs: number;
}

/** Shows a toast (replacing the current one) and returns its id. */
type ShowToast = (
	tone: Tone,
	title: string,
	description?: string,
	options?: ToastOptions
) => number;

const ToastContext = createContext<{
	show: ShowToast;
	dismiss: (id: number) => void;
} | null>(null);

const DURATION_MS = 4000;
/** Toasts with an action stay longer, so there is time to reach it. */
const ACTION_DURATION_MS = 6000;
/** Clears the tab bar (about 64 dp) on tab screens. */
const BOTTOM_OFFSET = 80;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const nextId = useRef(0);
	const insets = useSafeAreaInsets();

	const show = useCallback<ShowToast>(
		(tone, title, description, options = {}) => {
			nextId.current += 1;
			const id = nextId.current;
			const { action } = options;
			setToast({
				id,
				tone,
				title,
				description,
				action,
				durationMs:
					options.durationMs ?? (action ? ACTION_DURATION_MS : DURATION_MS),
			});
			const text = description ? `${title}. ${description}` : title;
			AccessibilityInfo.announceForAccessibility(
				action ? `${text}. ${action.label} disponível.` : text
			);
			return id;
		},
		[]
	);

	const dismiss = useCallback((id: number) => {
		setToast((current) => (current?.id === id ? null : current));
	}, []);

	const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), toast.durationMs);
		return () => clearTimeout(timer);
	}, [toast]);

	return (
		<ToastContext value={value}>
			{children}
			{toast ? (
				<Animated.View
					key={toast.id}
					entering={FadeInDown}
					exiting={FadeOutDown}
					pointerEvents={toast.action ? "box-none" : "none"}
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
						{toast.action ? (
							<ActionButton
								action={toast.action}
								onDone={() => dismiss(toast.id)}
							/>
						) : null}
					</View>
				</Animated.View>
			) : null}
		</ToastContext>
	);
}

function ActionButton({
	action,
	onDone,
}: {
	action: ToastAction;
	onDone: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={action.label}
			onPress={() => {
				onDone();
				action.onPress();
			}}
			hitSlop={8}
			className="-my-2 min-h-touch min-w-touch items-center justify-center rounded-md px-3 active:bg-border"
		>
			<Text className="font-semibold text-violet-300">{action.label}</Text>
		</Pressable>
	);
}

function useToastContext() {
	const context = use(ToastContext);
	if (!context) throw new Error("useToast outside <ToastProvider>");
	return context;
}

export function useToast(): ShowToast {
	return useToastContext().show;
}

/** Removes the toast with that id, if it is still the one on screen. */
export function useDismissToast(): (id: number) => void {
	return useToastContext().dismiss;
}
