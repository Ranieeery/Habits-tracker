import { View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import { AppRoutes } from "./app.routes";

export function Routes() {
    return (
        <View style={styles.view}>
            <NavigationContainer>
                <AppRoutes />
            </NavigationContainer>
        </View>
    );
} 

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: "#09090A",
    }
});