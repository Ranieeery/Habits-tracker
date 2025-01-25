import { useState } from "react";
import { View, StyleSheet, ScrollView, Text, TextInput } from "react-native";

import { BackButton } from "../components/BackButton";
import { Checkbox } from "../components/Checkbox";

const avaliableWeekDays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
];

export function New() {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.view}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <BackButton />

                <Text style={styles.title}>Criar hábito</Text>

                <Text style={styles.subtitle}>Qual seu comprometimento?</Text>

                <TextInput
                    style={[styles.input, isFocused && styles.focused]}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />

                <Text
                    style={[
                        styles.subtitle,
                        { marginTop: 16, marginBottom: 12 },
                    ]}
                >
                    Quais dias da semana?
                </Text>
                {avaliableWeekDays.map((day) => (
                    <Checkbox key={day} title={day} />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: "#01010A",
        paddingHorizontal: 32,
        paddingTop: 64,
    },
    title: {
        color: "white",
        fontWeight: "800",
        fontSize: 30,
        marginTop: 24,
    },
    subtitle: {
        color: "white",
        fontWeight: "600",
        fontSize: 16,
        marginTop: 24,
    },
    input: {
        height: 48,
        paddingLeft: 16,
        borderRadius: 8,
        marginTop: 12,
        backgroundColor: "#27272A",
        color: "white",
    },
    focused: {
        borderWidth: 2,
        borderColor: "#16A34A",
    },
});
