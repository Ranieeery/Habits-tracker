import { View, TouchableOpacity, TouchableOpacityProps, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Props extends TouchableOpacityProps {
    title: string;
    checked?: boolean;
}

export function Checkbox({ title, checked = false, ...rest }: Props) {
    return (
        <TouchableOpacity activeOpacity={0.7} style={styles.touchable} {...rest}>
            {checked ? (
                <View style={styles.view}>
                    <Feather name="check" size={20} color={"white"} />
                </View>
            ) : (
                <View style={styles.viewPlaceholder} />
            )}

            <Text style={styles.text}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touchable: {
        flexDirection: "row",
        marginBottom: 8,
        alignItems: "center",
    },
    view: {
        height: 32,
        width: 32,
        backgroundColor: "#16A34A",
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    viewPlaceholder: {
        height: 32,
        width: 32,
        borderRadius: 8,
        backgroundColor: "#18181A",
        borderColor: "#27272A",
    },
    text: {
        color: "white",
        fontSize: 16,
        marginLeft: 12,
    },
});
