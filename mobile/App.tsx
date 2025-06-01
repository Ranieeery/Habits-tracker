import "./lib/dayjs";

import { StatusBar } from "expo-status-bar";
import {
    useFonts,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { Loading } from "./src/components/Loading";
import { Routes } from "./src/routes";
import * as Notifications from "expo-notifications";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_600SemiBold,
        Inter_500Medium,
        Inter_800ExtraBold,
    });

    useEffect(() => {
        NavigationBar.setBackgroundColorAsync("#000000");
        NavigationBar.setButtonStyleAsync("light");
    }, []);

    if (!fontsLoaded) {
        return <Loading />;
    }

    return (
        <>
            <Routes />
            <StatusBar
                style="light"
                backgroundColor="transparent"
                translucent
            />
        </>
    );
}