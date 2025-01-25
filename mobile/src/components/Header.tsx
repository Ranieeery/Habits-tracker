import { StyleSheet, View, TouchableOpacity, Text } from "react-native";

import { Feather } from "@expo/vector-icons";

import Logo from "../assets/logo.svg";

export function Header() {
    return (
        <View style={styles.view}>
            <Logo />

            <TouchableOpacity activeOpacity={0.7} style={styles.touchable}>
                <Feather name="plus" color="#8E51FF" size={20} />
                <Text style={styles.text}>Novo</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    view: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    touchable: {
        flexDirection: "row",
        height: 56 ,
        paddingHorizontal: 16, 
        borderWidth: 1, 
        borderColor: "#8E51FF",
        borderRadius: 8,
        alignItems: "center",
    },
    text: {
        color: "white",
        marginLeft: 12,
        fontWeight: "600",
        fontSize: 16,
    },
});
