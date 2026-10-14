import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CalendarDate, Habit } from "@habits/contracts";
import {
	descriptionFirstLine,
	hasDescription,
	type PreviewItem,
	rescheduleAvailability,
	rescheduledLabel,
} from "@habits/core";
import { nightColors } from "@habits/design-tokens";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DescriptionSheet } from "@/features/habits/description-sheet.tsx";
import { useHabitActionsSheet } from "./habit-actions-sheet.tsx";
import { MoreOptionsButton } from "./habit-row.tsx";

/**
 * What is planned for a preview day (2.14.0) in one `night-surface` panel,
 * read only: no checkbox, nothing to mark. Each row is one accessible
 * element ("Nome, vence neste dia"); a deadline task due that day carries
 * the "Vence neste dia" badge (icon and text). The note icon still opens
 * the description, like on any other day. 2.16.0: a postponed occurrence
 * carries "Adiado de 20/10", and the rows whose occurrence can move have the
 * "more options" button with "Adiar" (no archiving here: that stays on
 * today), written to the outbox like everything else (offline too).
 */
export function PreviewList({
	items,
	date,
	today,
}: {
	items: readonly PreviewItem[];
	date: CalendarDate;
	today: CalendarDate;
}) {
	const [described, setDescribed] = useState<Habit | null>(null);
	const menu = useHabitActionsSheet();
	return (
		<View className="overflow-hidden rounded-xl border border-night-border bg-night-surface">
			<DescriptionSheet habit={described} onClose={() => setDescribed(null)} />
			{menu.sheet}
			{items.map((item, index) => (
				<PreviewRow
					key={item.habit.id}
					item={item}
					date={date}
					today={today}
					divider={index > 0}
					onShowDescription={() => setDescribed(item.habit)}
					onShowActions={menu.show}
				/>
			))}
		</View>
	);
}

function PreviewRow({
	item: { habit, dueOnDay, rescheduledFrom, rescheduleCount = 0 },
	date,
	today,
	divider,
	onShowDescription,
	onShowActions,
}: {
	item: PreviewItem;
	date: CalendarDate;
	today: CalendarDate;
	divider: boolean;
	onShowDescription: () => void;
	onShowActions: ReturnType<typeof useHabitActionsSheet>["show"];
}) {
	const more = useRef<View>(null);
	const firstLine = descriptionFirstLine(habit.description);
	const moved =
		rescheduledFrom === undefined
			? null
			: rescheduledLabel(rescheduledFrom, today);
	const availability = rescheduleAvailability(habit, {
		date,
		today,
		overdue: false,
		done: false,
		rescheduledFrom: rescheduledFrom ?? null,
		count: rescheduleCount,
	});
	return (
		<View
			className={`flex-row items-center ${divider ? "border-t border-night-border" : ""}`}
		>
			<View
				accessible
				accessibilityLabel={[
					habit.name,
					dueOnDay && "vence neste dia",
					moved?.spoken,
				]
					.filter(Boolean)
					.join(", ")}
				className="min-h-14 flex-1 flex-row items-center gap-4 px-4 py-3"
			>
				<MaterialCommunityIcons
					name="circle-outline"
					size={20}
					color={nightColors.subtle}
				/>
				<View className="flex-1 items-start gap-1.5">
					<Text className="text-base font-medium text-night-foreground">
						{habit.name}
					</Text>
					{firstLine ? (
						<Text
							numberOfLines={1}
							className="self-stretch text-sm text-night-muted"
						>
							{firstLine}
						</Text>
					) : null}
					{dueOnDay ? (
						<View className="flex-row items-center gap-1 rounded-md border border-night-accent/40 bg-night-accent/15 px-2 py-0.5">
							<MaterialCommunityIcons
								name="calendar-end"
								size={14}
								color={nightColors.accent.text}
							/>
							<Text className="text-xs font-medium text-night-accent-text">
								Vence neste dia
							</Text>
						</View>
					) : null}
					{moved ? (
						<View className="flex-row items-center gap-1 rounded-md border border-night-border-strong px-2 py-0.5">
							<MaterialCommunityIcons
								name="calendar-arrow-right"
								size={14}
								color={nightColors.muted}
							/>
							<Text className="text-xs font-medium text-night-muted">
								{moved.text}
							</Text>
						</View>
					) : null}
				</View>
			</View>
			{hasDescription(habit) ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Descrição de ${habit.name}`}
					onPress={onShowDescription}
					className={`size-touch items-center justify-center rounded-md active:bg-night-surface-raised ${availability.state === "hidden" ? "mr-2" : ""}`}
				>
					<MaterialCommunityIcons
						name="text-box-outline"
						size={22}
						color={nightColors.muted}
					/>
				</Pressable>
			) : null}
			{availability.state !== "hidden" ? (
				<MoreOptionsButton
					ref={more}
					name={habit.name}
					onPress={() =>
						onShowActions(habit, more.current, {
							availability,
							occurrence: {
								original: rescheduledFrom ?? date,
								effective: date,
								count: rescheduleCount,
							},
							archive: false,
						})
					}
				/>
			) : null}
		</View>
	);
}
