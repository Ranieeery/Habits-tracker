import { View, StyleSheet } from "react-native";

export function Habit() {
    return <View style={styles.view}></View>;
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: "#09090A",
        paddingHorizontal: 32,
        paddingTop: 64,
    },
});
