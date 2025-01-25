import { StyleSheet, View } from "react-native";

export function Header() {
    return <View style={styles.container}></View>;
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 0,
    },
});
