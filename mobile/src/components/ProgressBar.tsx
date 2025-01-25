import { View, StyleSheet } from "react-native";

interface Props {
    progress?: number;
}

export function ProgressBar({ progress = 0 }: Props) {
    return (
        <View style={styles.container}>
            <View style={[styles.bar, { width: `${progress}%` }]} />
        </View>

    )
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
