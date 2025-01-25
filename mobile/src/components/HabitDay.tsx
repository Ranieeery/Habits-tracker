import {
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    TouchableOpacityProps,
} from "react-native";

const WEEK_DAYS = 7;
const SCREEN_HORIZONTAL_PADDING = (32 * 2) / 5;

export const DAY_MARGIN_BETWEEN = 8;
export const DAY_SIZE =
    Dimensions.get("screen").width / WEEK_DAYS -
    (SCREEN_HORIZONTAL_PADDING + 5);

interface Props extends TouchableOpacityProps {}

export function HabitDay({ ...rest }: Props) {
    return (
        <TouchableOpacity
            style={[
                styles.touchable,
                {
                    width: DAY_SIZE,
                    height: DAY_SIZE,
                },
            ]}
            activeOpacity={0.75}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    touchable: {
        backgroundColor: "#18181A",
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#27272A",
        margin: 4,
    },
});
