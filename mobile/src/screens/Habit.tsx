import { useEffect, useState } from "react";
import { useRoute } from "@react-navigation/native";
import { View, StyleSheet, ScrollView, Text, Alert } from "react-native";
import dayjs from "dayjs";

import { BackButton } from "../components/BackButton";
import { ProgressBar } from "../components/ProgressBar";
import { Loading } from "../components/Loading";
import { api } from "../../lib/axios";
import { Checkbox } from "../components/Checkbox";
import { generateProgressPercentage } from "../utils/generate-progress-percentage";

interface Params {
    date: string;
}

interface DayInfoProps {
    possibleHabits: {
        id: string;
        title: string;
    }[];
    completedHabits: string[];
}

export function Habit() {
    const route = useRoute();
    const { date } = route.params as Params;
    const [loading, setLoading] = useState(true);
    const [dayInfo, setDayInfo] = useState<DayInfoProps | null>(null);
    const [completedHabits, setCompletedHabits] = useState<string[]>([]);

    const dayOfWeek = dayjs(date).format("dddd");
    const dayAndMonth = dayjs(date).format("DD/MM");

    const habitProgress = dayInfo?.possibleHabits.length ? generateProgressPercentage(dayInfo.possibleHabits.length, completedHabits.length) : 0; 

    async function fetchHabit() {
        try {
            setLoading(true);

            const response = await api.get("/day", { params: { date } });
            setDayInfo(response.data);
            setCompletedHabits(response.data.completedHabits);
        } catch (error) {
            console.log(error);
            Alert.alert("Ops", "Erro ao carregar hábito");
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleHabits(habitId: string) {
        if (completedHabits.includes(habitId)) {
            setCompletedHabits(
                completedHabits.filter((habit) => habit !== habitId)
            );
        } else {
            setCompletedHabits([...completedHabits, habitId]);
        }
    }

    useEffect(() => {
        fetchHabit();
    }, []);

    if (loading) {
        return <Loading />;
    }

    return (
        <View style={styles.view}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 50 }}
            >
                <BackButton />

                <Text style={styles.title}>{dayOfWeek}</Text>
                <Text style={styles.subtitle}>{dayAndMonth}</Text>

                <ProgressBar progress={habitProgress} />

                <View style={{ marginTop: 24 }}>
                    {dayInfo?.possibleHabits &&
                        dayInfo.possibleHabits.map((habit) => (
                            <Checkbox
                                key={habit.id}
                                title={habit.title}
                                checked={completedHabits.includes(habit.id)}
                                onPress={() => handleToggleHabits(habit.id)}
                            />
                        ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: "#09090A",
        paddingHorizontal: 32,
        paddingTop: 64,
    },
    title: {
        marginTop: 24,
        color: "#A1A1AA",
        fontWeight: "600",
        fontSize: 16,
        textTransform: "lowercase",
    },
    subtitle: {
        color: "white",
        fontWeight: "800",
        fontSize: 30,
    },
});
