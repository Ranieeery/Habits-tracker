import { StyleSheet, View, Text, ScrollView } from "react-native";

import { generateDates } from "../utils/generate-dates";

import { Header } from "../components/Header";
import { HabitDay, DAY_SIZE } from "../components/HabitDay";

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

const datesFromYearStart = generateDates();
const minumunSummaryDates = 18 * 5;
const amountOfDatesToFill = minumunSummaryDates - datesFromYearStart.length;

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
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 50, paddingLeft: 16 }}
            >
                <View style={styles.habits}>
                    {datesFromYearStart.map((date) => (
                        <HabitDay key={date.toISOString()} />
                    ))}
                    {amountOfDatesToFill > 0 &&
                        Array.from({ length: amountOfDatesToFill }).map(
                            (_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.arrayView,
                                        {
                                            width: DAY_SIZE,
                                            height: DAY_SIZE,
                                        },
                                    ]}
                                />
                            )
                        )}
                </View>
            </ScrollView>
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
        alignItems: "center",
        justifyContent: "center",
    },
    view: {
        flexDirection: "row",
        marginTop: 24,
        marginBottom: 2,
    },
    text: {
        color: "#A1A1AA",
        fontSize: 20,
        fontWeight: "bold",
        textAlign: "center",
        marginHorizontal: 4,
    },
    habits: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    arrayView: {
        backgroundColor: "#18181b",
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#27272A",
        margin: 4,
        opacity: 0.4,
    },
});
