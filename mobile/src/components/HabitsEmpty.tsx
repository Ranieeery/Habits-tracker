import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

export function HabitsEmpty() {
    const { navigate } = useNavigation();

    return (
        <View style={styles.container}>
            <Text style={styles.message}>
                Você não tem nenhum hábito cadastrado ainda.{" "}
                <Text style={styles.linkText} onPress={() => navigate("new")}>
                    Clique aqui
                </Text>{" "}
                para adicionar um novo hábito.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    message: {
        color: "#A1A1AA",
        fontSize: 16,
    },
    linkText: {
        color: "#A78BFA",
        fontSize: 16,
        textDecorationLine: "underline",
    },
});
