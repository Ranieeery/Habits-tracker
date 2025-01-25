import { StyleSheet, View, Text } from "react-native";

import { generateDates } from "../utils/generate-dates";

import { Header } from "../components/Header";
import { HabitDay, DAY_SIZE } from "../components/HabitDay";

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

export function Home() {
    return (
        <View style={styles.container}>
            <Header />

            <View style={styles.view}>
                {weekDays.map((day, i) => (
                    <Text
                        key={`${weekDays} + ${i}`}
                        style={[styles.text, { width: DAY_SIZE }]}
                    >
                        {day}
                    </Text>
                ))}
            </View>

            <HabitDay />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#09090A",
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 64,
    },
    view: {
        flexDirection: "row",
        marginTop: 24,
        marginBottom: 2,
    },
    text: {
        color: "#a1a1aa",
        fontSize: 20,
        fontWeight: "bold",
        textAlign: "center",
        marginHorizontal: 4,
        marginLeft: 8,
    },
});
