import { useState } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { BackButton } from "../components/BackButton";
import { Checkbox } from "../components/Checkbox";
import { api } from "../../lib/axios";

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
    const [weekDays, setWeekDays] = useState<number[]>([]);
    const [title, setTitle] = useState("");

    function handleWeekDay(day: number) {
        if (weekDays.includes(day)) {
            setWeekDays((prevState) => prevState.filter((d) => d !== day));
        } else {
            setWeekDays((prevState) => [...prevState, day]);
        }
    }

    async function handleCreateNewHabit() {
        try {
            if (!title.trim() || weekDays.length === 0) {
                Alert.alert("Erro", "O título e hábitos são obrigatórios");
            } else {
                await api.post("/habits", {
                    title,
                    weekDays,
                });

                Alert.alert("Novo hábito", "Hábito criado com sucesso!");
            }
        } catch (error) {
            console.log(error);
            Alert.alert("Opss", "Erro ao criar novo hábito");
        } finally {
            setTitle("");
            setWeekDays([]);
        }
    }

    return (
        <View style={styles.view}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 50 }}
            >
                <BackButton />

                <Text style={styles.title}>Criar hábito</Text>

                <Text style={styles.subtitle}>Qual seu comprometimento?</Text>

                <TextInput
                    style={[styles.input, isFocused && styles.focused]}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="ex.: Estudar, exercícios, etc"
                    placeholderTextColor={"#8E8E93"}
                    onChangeText={setTitle}
                    value={title}
                />

                <Text
                    style={[
                        styles.subtitle,
                        { marginTop: 16, marginBottom: 12 },
                    ]}
                >
                    Quais dias da semana?
                </Text>
                {avaliableWeekDays.map((day, i) => (
                    <Checkbox
                        key={day}
                        title={day}
                        checked={weekDays.includes(i)}
                        onPress={() => handleWeekDay(i)}
                    />
                ))}

                <TouchableOpacity
                    style={styles.touchable}
                    activeOpacity={0.7}
                    onPress={handleCreateNewHabit}
                >
                    <Feather name="check" size={24} color={"white"} />
                    <Text style={styles.text}>Confirmar</Text>
                </TouchableOpacity>
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
    text: {
        fontWeight: "600",
        fontSize: 16,
        color: "white",
        marginLeft: 8,
    },
    touchable: {
        width: "100%",
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#16A34A",
        borderRadius: 6,
        marginTop: 24,
    },
});
