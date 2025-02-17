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

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_600SemiBold,
        Inter_500Medium,
        Inter_800ExtraBold,
    });

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
