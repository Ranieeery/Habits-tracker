import { StyleSheet, View, Text, ScrollView, Alert } from "react-native";

import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

import { Header } from "../components/Header";
import { Loading } from "../components/Loading";
import { HabitDay, DAY_SIZE } from "../components/HabitDay";

import { generateDates } from "../utils/generate-dates";
import { api } from "../../lib/axios";

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

const datesFromYearStart = generateDates();
const minumunSummaryDates = 18 * 5;
const amountOfDatesToFill = minumunSummaryDates - datesFromYearStart.length;

const firstDayOfTheYear = dayjs().startOf("year").day();

type SummaryProps = {
    id: string;
    date: string;
    amount: number;
    completed: number;
}[];

export function Home() {
    const [loading, setLoading] = useState(true);
    const [summary, setsummary] = useState<SummaryProps | null>(null);

    const { navigate } = useNavigation();

    async function fetchData() {
        try {
            setLoading(true);

            const response = await api.get("/summary");
            setsummary(response.data);
        } catch (error) {
            Alert.alert("Opsss 😵😵‍💫", "Erro ao carregar dados");
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return <Loading />;
    }

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
                {summary && (
                    <View style={styles.habits}>
                        {firstDayOfTheYear > 0 &&
                            Array.from({ length: firstDayOfTheYear }).map(
                                (_, i) => {
                                    return generateBlankSummaryDates(i);
                                }
                            )}

                        {datesFromYearStart.map((date) => {
                            const dayWithHabits = summary.find((day) => {
                                return dayjs().isSame(day.date, "day");
                            });

                            return (
                                <HabitDay
                                    key={date.toISOString()}
                                    date={date}
                                    amount={dayWithHabits?.amount}
                                    completed={dayWithHabits?.completed}
                                    onPress={() =>
                                        navigate("habit", {
                                            date: date.toISOString(),
                                        })
                                    }
                                />
                            );
                        })}
                        {amountOfDatesToFill > 0 &&
                            Array.from({
                                length: amountOfDatesToFill - firstDayOfTheYear,
                            }).map((_, i) => {
                                return generateBlankSummaryDates(i);
                            })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

function generateBlankSummaryDates(i: number) {
    return (
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
