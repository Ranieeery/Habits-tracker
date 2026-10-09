import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

interface Props {
    progress?: number;
}

export function ProgressBar({ progress = 0 }: Props) {
    const sharedProgress = useSharedValue(progress);

    const style = useAnimatedStyle(() => {
        return {
            width: `${sharedProgress.value}%`,
        };
    });

    useEffect(() => {
        sharedProgress.value = withTiming(progress, { duration: 500 });
    }, [progress]);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.bar, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: 12,
        borderRadius: 12,
        backgroundColor: "#3F3F46",
        marginTop: 16,
    },
    bar: {
        height: 12,
        borderRadius: 12,
        backgroundColor: "#7C3AED",
    },
});
