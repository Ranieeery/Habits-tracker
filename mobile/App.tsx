import { StatusBar } from "expo-status-bar";
import {
    useFonts,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { Loading } from "./src/components/Loading";
import { Home } from "./src/screens/Home";
import "./styles/global.css";

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
            <Home />
            <StatusBar style="light" translucent />
        </>
    );
}
