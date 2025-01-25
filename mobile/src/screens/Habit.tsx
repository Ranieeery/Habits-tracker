import { useRoute } from "@react-navigation/native";
import { View, StyleSheet, ScrollView, Text } from "react-native";
import dayjs from "dayjs";

import { BackButton } from "../components/BackButton";

interface Params {
    date: string;
}

export function Habit() {
    const route = useRoute();
    const { date } = route.params as Params;

    const dayOfWeek = dayjs(date).format("dddd");
    const dayAndMonth = dayjs(date).format("DD/MM");

    return (
        <View style={styles.view}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 50 }}
            >
                <BackButton />

                <Text style={styles.title}>{dayOfWeek}</Text>
                <Text style={styles.subtitle}>{dayAndMonth}</Text>
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
