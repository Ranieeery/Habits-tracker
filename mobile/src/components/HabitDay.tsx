import {
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    TouchableOpacityProps,
} from "react-native";
import { generateProgressPercentage } from "../utils/generate-progress-percentage";

const WEEK_DAYS = 7;
const SCREEN_HORIZONTAL_PADDING = (32 * 2) / 5;

export const DAY_MARGIN_BETWEEN = 8;
export const DAY_SIZE =
    Dimensions.get("screen").width / WEEK_DAYS -
    (SCREEN_HORIZONTAL_PADDING + 5);

interface Props extends TouchableOpacityProps {
    amount?: number;
    completed?: number;
    date: Date;
}

export function HabitDay({ amount = 0, completed = 0, date, ...rest }: Props) {
    const completedPercentage =
        amount > 0 ? generateProgressPercentage(amount, completed) : 0;
    console.log(completedPercentage);

    const getColorStyles = () => {
        if (completedPercentage == 0) {
            return { backgroundColor: "#18181B", borderColor: "#27272A" };
        }
        if (completedPercentage > 0 && completedPercentage < 20) {
            return { backgroundColor: "#8B5CF6", borderColor: "#A78BFA" };
        }
        if (completedPercentage >= 20 && completedPercentage < 40) {
            return { backgroundColor: "#7C3AED", borderColor: "#8B5CF6" };
        }
        if (completedPercentage >= 40 && completedPercentage < 60) {
            return { backgroundColor: "#6D28D9", borderColor: "#7C3AED" };
        }
        if (completedPercentage >= 60 && completedPercentage < 80) {
            return { backgroundColor: "#5B21B6", borderColor: "#6D28D9" };
        }
        if (completedPercentage >= 80 && completedPercentage <= 100) {
            return { backgroundColor: "#4C1D95", borderColor: "#5B21B6" };
        }
    };
    return (
        <TouchableOpacity
            style={[styles.touchable, getColorStyles()]}
            activeOpacity={0.75}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    touchable: {
        borderRadius: 8,
        borderWidth: 2,
        margin: 4,
        width: DAY_SIZE,
        height: DAY_SIZE,
    },
});
